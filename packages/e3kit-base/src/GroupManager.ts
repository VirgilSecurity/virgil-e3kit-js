import {
    CloudGroupTicketStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    KeyknoxClient,
} from '@virgilsecurity/keyknox';
import { ICard } from './types';
import { CLOUD_GROUP_SESSIONS_ROOT } from './constants';
import { Ticket } from './groups/Ticket';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import { RegisterRequiredError } from './errors';
import { Group } from './groups/Group';
import { CardManager } from 'virgil-sdk';

export class GroupManager {
    private _privateKeyLoader: PrivateKeyLoader;
    private _cardManager: CardManager;
    private _localGroupStorage = new Map<string, Group>();

    constructor(privateKeyLoader: PrivateKeyLoader, cardManager: CardManager) {
        this._privateKeyLoader = privateKeyLoader;
        this._cardManager = cardManager;
    }

    async store(ticket: Ticket, cards: ICard[]) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await cloudTicketStorage.store(ticket.groupSessionMessage, cards);
        const group = new Group({
            initiator: this.selfIdentity,
            tickets: [ticket],
            privateKeyLoader: this._privateKeyLoader,
            cardManager: this._cardManager,
            groupManager: this,
        });
        // TODO store the group in device's persistent storage
        this._localGroupStorage.set(ticket.groupSessionMessage.sessionId, group);
        return group;
    }

    async pull(sessionId: string, initiatorCard: ICard) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        const cloudTickets = await cloudTicketStorage.retrieve(
            sessionId,
            initiatorCard.identity,
            initiatorCard.publicKey,
        );
        const group = new Group({
            initiator: initiatorCard.identity,
            tickets: cloudTickets.map(ct => new Ticket(ct.groupSessionMessageInfo, ct.identities)),
            privateKeyLoader: this._privateKeyLoader,
            cardManager: this._cardManager,
            groupManager: this,
        });
        // TODO store the group in device's persistent storage
        this._localGroupStorage.set(sessionId, group);
        return group;
    }

    async retrieve(sessionId: string) {
        // TODO get the group from the device's persistent storage
        return this._localGroupStorage.get(sessionId);
    }

    async addAccess(sessionId: string, allowedCards: ICard[]) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await cloudTicketStorage.addRecipients(sessionId, allowedCards);
    }

    async removeAccess(sessionId: string, forbiddenIdentities: string[]) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await Promise.all(
            forbiddenIdentities.map(identity =>
                cloudTicketStorage.removeRecipient(sessionId, identity),
            ),
        );
    }

    async delete(sessionId: string) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await cloudTicketStorage.delete(sessionId);
        // TODO remove from the device's persistent storage
        this._localGroupStorage.delete(sessionId);
    }

    private get selfIdentity() {
        return this._privateKeyLoader.identity;
    }

    private async getCloudTicketStorage() {
        const identity = this._privateKeyLoader.identity;
        const { virgilCrypto, accessTokenProvider, apiUrl } = this._privateKeyLoader.options;
        const keyPair = await this._privateKeyLoader.loadLocalKeyPair();
        if (!keyPair) {
            throw new RegisterRequiredError();
        }

        const keyknoxManager = new KeyknoxManager(
            new KeyknoxCrypto(virgilCrypto),
            new KeyknoxClient(accessTokenProvider, apiUrl),
        );

        return new CloudGroupTicketStorage({
            keyknoxManager,
            identity,
            ...keyPair,
            root: CLOUD_GROUP_SESSIONS_ROOT,
        });
    }
}
