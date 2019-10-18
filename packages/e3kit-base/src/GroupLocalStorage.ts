/// <reference path="../declarations.d.ts" />

import levelup, { LevelUp } from 'levelup';
import sub from 'subleveldown';
import {
    AbstractLevelDOWN,
    AbstractBatch,
    AbstractIteratorOptions,
    ErrorCallback,
} from 'abstract-leveldown';
import { Ticket, RawGroup, GroupInfo } from './types';

declare module 'levelup' {
    interface LevelUp {
        clear(options?: AbstractIteratorOptions): Promise<void>;
        clear(options?: AbstractIteratorOptions, callback?: ErrorCallback): void;
    }
}

export interface RetrieveOptions {
    ticketCount?: number;
    epochNumber?: number;
}

export class GroupLocalStorage {
    private _db: LevelUp;

    constructor(identity: string, leveldown: AbstractLevelDOWN) {
        const rootLevel = levelup(leveldown);
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

        const [info, tickets] = await Promise.all([
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
        const epochNumberStr = String(epochNumber);
        const epochNumberEncodedLength = epochNumberStr.length.toString(36);
        return `${sessionId}!${epochNumberEncodedLength}!${epochNumberStr}`;
    }
}
