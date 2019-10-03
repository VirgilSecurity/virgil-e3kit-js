import { IGroupSession, ICrypto, Data } from '../types';
import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { Ticket } from './Ticket';
import { RegisterRequiredError } from '../errors';
import { ICard } from 'virgil-sdk';

export class Group {
    selfIdentity: string;
    initiator: string;
    participants: string[];

    private _session: IGroupSession;
    private _virgilCrypto: ICrypto;
    private _privateKeyLoader: PrivateKeyLoader;

    constructor(options: {
        initiator: string;
        tickets: Ticket[];
        privateKeyLoader: PrivateKeyLoader;
    }) {
        const sortedTickets = options.tickets
            .slice()
            .sort((a, b) => a.groupSessionMessage.epochNumber - b.groupSessionMessage.epochNumber);
        const lastTicket = sortedTickets[sortedTickets.length - 1];
        if (!lastTicket) {
            throw new Error('Failed to construct Group. Group must have at least one ticket;');
        }
        this.selfIdentity = options.privateKeyLoader.identity;
        this.initiator = options.initiator;
        this.participants = lastTicket.participants;

        this._virgilCrypto = options.privateKeyLoader.options.virgilCrypto;
        this._privateKeyLoader = options.privateKeyLoader;
        this._session = this._virgilCrypto.importGroupSession(
            sortedTickets.map(t => t.groupSessionMessage.data),
        );
    }

    async encrypt(data: Data) {
        const privateKey = await this._privateKeyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new RegisterRequiredError();
        }
        return this._session.encrypt(data, privateKey);
    }

    async decrypt(encryptedData: Data, senderCard: ICard) {
        return this._session.decrypt(encryptedData, senderCard.publicKey);
    }
}
