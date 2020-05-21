/// <reference path="../declarations.d.ts" />
import levelup, { LevelUp } from 'levelup';
import sub from 'subleveldown';
import { AbstractLevelDOWN, AbstractBatch } from 'abstract-leveldown';
import { Ticket, RawGroup, GroupInfo, IKeyPair, ICrypto } from './types';
import VirgilEncryptDown from './virgil-encrypt-down';

export interface RetrieveOptions {
    ticketCount?: number;
    epochNumber?: number;
}

export interface GroupLocalStorageConstructorParams {
    identity: string;
    leveldown: AbstractLevelDOWN;
    virgilCrypto: ICrypto;
}

export class GroupLocalStorage {
    private _db: LevelUp;
    private _encryptionLevel: VirgilEncryptDown<string>;

    constructor({ identity, virgilCrypto, leveldown }: GroupLocalStorageConstructorParams) {
        this._encryptionLevel = new VirgilEncryptDown(leveldown, { virgilCrypto });
        const rootLevel = levelup(this._encryptionLevel);
        const identityLevel = sub(rootLevel, identity);
        this._db = sub(identityLevel, 'GROUPS', { valueEncoding: 'json' });
    }

    async store(rawGroup: RawGroup) {
        const lastTicket = rawGroup.tickets[rawGroup.tickets.length - 1];
        if (!lastTicket) {
            throw new Error('Attempted to store group without tickets.');
        }

        const { sessionId } = lastTicket.groupSessionMessage;
        const insertInfo: AbstractBatch<string, GroupInfo> = {
            type: 'put',
            key: sessionId,
            value: rawGroup.info,
        };
        const insertTickets: AbstractBatch<string, Ticket>[] = rawGroup.tickets.map(ticket => ({
            type: 'put',
            key: this.getTicketKey(sessionId, ticket.groupSessionMessage.epochNumber),
            value: ticket,
        }));

        await this._db.batch([insertInfo, ...insertTickets]);
    }

    async retrieve(sessionId: string, options: RetrieveOptions): Promise<RawGroup | null> {
        const hasTicketCount = typeof options.ticketCount === 'number';
        const hasEpochNumber = typeof options.epochNumber === 'number';

        if (hasTicketCount === hasEpochNumber) {
            throw new Error('Either "ticketCount" or "epochNumber" option must be provided');
        }

        const [info, tickets] = await Promise.all<GroupInfo | null, Ticket[]>([
            this.retrieveGroupInfo(sessionId),
            options.ticketCount
                ? this.retrieveNLastTickets(sessionId, options.ticketCount)
                : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  this.retrieveTicketByEpochNumber(sessionId, options.epochNumber!),
        ]);

        if (!info || tickets.length === 0) return null;

        return { info, tickets };
    }

    async delete(sessionId: string) {
        const prefix = sessionId;
        await this._db.clear({
            gt: prefix,
            lte: prefix + '\xff',
        });
    }

    async reset() {
        await this._db.clear();
    }

    async addParticipants(sessionId: string, participants: string[]) {
        const [ticket] = await this.retrieveNLastTickets(sessionId, 1);
        const newTicket: Ticket = {
            participants: ticket.participants.concat(participants),
            groupSessionMessage: ticket.groupSessionMessage,
        };
        const key = this.getTicketKey(sessionId, ticket.groupSessionMessage.epochNumber);
        // TODO: figure out why 'this._db.put' doesn't work
        // await this._db.put(key, newTicket);
        await this._db.batch([{ type: 'put', key, value: newTicket }]);
    }

    setEncryptionKeyPair(keyPair: IKeyPair) {
        this._encryptionLevel.setKeyPair(keyPair);
    }

    private async retrieveGroupInfo(sessionId: string): Promise<GroupInfo | null> {
        try {
            return await this._db.get(sessionId);
        } catch (err) {
            if (err.notFound) {
                return null;
            }
            throw err;
        }
    }

    private retrieveNLastTickets(sessionId: string, ticketCount: number): Promise<Ticket[]> {
        return new Promise((resolve, reject) => {
            const tickets: Ticket[] = [];
            let error: Error | undefined = undefined;

            const prefix = sessionId + '!';
            this._db
                .createReadStream({
                    gt: prefix,
                    lte: prefix + '\xff',
                    reverse: true,
                    limit: ticketCount,
                })
                .on('data', data => tickets.unshift(data.value))
                .on('error', err => (error = err))
                .on('end', () => (error ? reject(error) : resolve(tickets)));
        });
    }

    private async retrieveTicketByEpochNumber(
        sessionId: string,
        epochNumber: number,
    ): Promise<Ticket[]> {
        const key = this.getTicketKey(sessionId, epochNumber);
        try {
            const ticket = await this._db.get(key);
            return [ticket];
        } catch (err) {
            if (err.notFound) {
                return [];
            }
            throw err;
        }
    }

    private getTicketKey(sessionId: string, epochNumber: number) {
        // The structure of the ticket key:
        // `<session_id>!<number_of_digits_in_epoch_number_encoded_as_single_char>!<epoch_number>`
        // The reasoning:
        // keys in LevelDB are stored in alphabetical (lexicographic) order,
        // which means that if we just put the epoch number in the key we'll
        // start getting wrong results when reading a stream of tickets because
        // '11' is less than '2', for example.
        // Storing the number of digits in the key allows us to only compare
        // epochs with the same number of digits to each other and have tickets
        // with larger number of digits always be greater than the ones with fewer digits.
        // Since number of digits is also a number and hence susceptible to the
        // same problem, we encode it in base 36 to get a single character so we
        // can handle epoch numbers with up to 35 digits in them (which is more than
        // necessary since epoch number is uint32 in the virgil crypto library)
        const epochNumberStr = String(epochNumber);
        const epochNumberEncodedLength = epochNumberStr.length.toString(36);
        return `${sessionId}!${epochNumberEncodedLength}!${epochNumberStr}`;
    }
}
