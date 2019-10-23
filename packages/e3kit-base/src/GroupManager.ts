import {
    CloudGroupTicketStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    KeyknoxClient,
    GroupTicket,
} from '@virgilsecurity/keyknox';
import { CardManager } from 'virgil-sdk';
import { AbstractLevelDOWN } from 'abstract-leveldown';

import { ICard, Ticket, IKeyPair } from './types';
import { CLOUD_GROUP_SESSIONS_ROOT, MAX_EPOCHS_IN_GROUP_SESSION } from './constants';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import { GroupError, GroupErrorCode, RegisterRequiredError } from './errors';
import { Group } from './groups/Group';
import { GroupLocalStorage, RetrieveOptions } from './GroupLocalStorage';
import { isSafeInteger } from './utils/number';

export interface GroupManagerConstructorParams {
    identity: string;
    keyPair: IKeyPair;
    privateKeyLoader: PrivateKeyLoader;
    cardManager: CardManager;
    groupStorageLeveldown: AbstractLevelDOWN;
}

export class GroupManager {
    private _selfIdentity: string;
    private _localGroupStorage: GroupLocalStorage;
    private _privateKeyLoader: PrivateKeyLoader;
    private _cardManager: CardManager;

    constructor({
        identity,
        keyPair,
        privateKeyLoader,
        cardManager,
        groupStorageLeveldown,
    }: GroupManagerConstructorParams) {
        this._selfIdentity = identity;
        this._privateKeyLoader = privateKeyLoader;
        this._cardManager = cardManager;
        this._localGroupStorage = new GroupLocalStorage({
            identity,
            keyPair,
            leveldown: groupStorageLeveldown,
            virgilCrypto: privateKeyLoader.options.virgilCrypto,
        });
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
        this._localGroupStorage.store({
            info: { initiator: this.selfIdentity },
            tickets: [ticket],
        });
        return group;
    }

    async pull(sessionId: string, initiatorCard: ICard) {
        let cloudTickets: GroupTicket[];
        try {
            const cloudTicketStorage = await this.getCloudTicketStorage();
            cloudTickets = await cloudTicketStorage.retrieve(
                sessionId,
                initiatorCard.identity,
                initiatorCard.publicKey,
            );
        } catch (err) {
            if (err.name === 'GroupTicketDoesntExistError') {
                await this._localGroupStorage.delete(sessionId);
                throw new GroupError(
                    GroupErrorCode.RemoteGroupNotFound,
                    'Group with given id and initiator could not be found',
                );
            }
            throw err;
        }

        const initiator = initiatorCard.identity;
        const tickets = cloudTickets.map(ct => ({
            groupSessionMessage: ct.groupSessionMessageInfo,
            participants: ct.identities,
        }));
        const group = new Group({
            initiator,
            tickets,
            privateKeyLoader: this._privateKeyLoader,
            cardManager: this._cardManager,
            groupManager: this,
        });
        this._localGroupStorage.store({ info: { initiator }, tickets });
        return group;
    }

    async retrieve(sessionId: string, epochNumber?: number) {
        const options: RetrieveOptions = isSafeInteger(epochNumber)
            ? { epochNumber }
            : { ticketCount: MAX_EPOCHS_IN_GROUP_SESSION };

        const rawGroup = await this._localGroupStorage.retrieve(sessionId, options);

        if (!rawGroup) return null;

        return new Group({
            initiator: rawGroup.info.initiator,
            tickets: rawGroup.tickets,
            privateKeyLoader: this._privateKeyLoader,
            cardManager: this._cardManager,
            groupManager: this,
        });
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
        await this._localGroupStorage.delete(sessionId);
    }

    async reAddAccess(sessionId: string, allowedCard: ICard) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await cloudTicketStorage.reAddRecipient(sessionId, allowedCard);
    }

    async cleanup() {
        await this._localGroupStorage.reset();
    }

    private get selfIdentity() {
        return this._selfIdentity;
    }

    private async getCloudTicketStorage() {
        const keyPair = await this._privateKeyLoader.loadLocalKeyPair();
        if (!keyPair) {
            // TODO replace with PrivateKeyMissingError
            throw new RegisterRequiredError();
        }

        const { virgilCrypto, accessTokenProvider, apiUrl } = this._privateKeyLoader.options;

        const keyknoxManager = new KeyknoxManager(
            new KeyknoxCrypto(virgilCrypto),
            new KeyknoxClient(accessTokenProvider, apiUrl),
        );

        return new CloudGroupTicketStorage({
            root: CLOUD_GROUP_SESSIONS_ROOT,
            identity: this.selfIdentity,
            keyknoxManager,
            ...keyPair,
        });
    }
}
