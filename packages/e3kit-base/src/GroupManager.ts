import {
    CloudGroupTicketStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    KeyknoxClient,
    GroupTicket,
} from '@virgilsecurity/keyknox';
import { CardManager } from 'virgil-sdk';
import { AbstractLevelDOWN } from 'abstract-leveldown';

import { ICard, Ticket } from './types';
import { CLOUD_GROUP_SESSIONS_ROOT, MAX_EPOCHS_IN_GROUP_SESSION } from './constants';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import { RegisterRequiredError, GroupError, GroupErrorCode } from './errors';
import { Group } from './groups/Group';
import { GroupLocalStorage, RetrieveOptions } from './GroupLocalStorage';

export interface GroupManagerConstructorParams {
    keyLoader: PrivateKeyLoader;
    cardManager: CardManager;
    groupStorageLeveldown: AbstractLevelDOWN;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInteger = (val: any): val is number => {
    if (Number.isInteger) return Number.isInteger(val);
    return typeof val === 'number' && isFinite(val) && Math.floor(val) === val;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isSafeInteger = (val: any): val is number => {
    if (Number.isSafeInteger) return Number.isSafeInteger(val);
    return isInteger(val) && Math.abs(val) <= Number.MAX_SAFE_INTEGER;
};

export class GroupManager {
    private _privateKeyLoader: PrivateKeyLoader;
    private _cardManager: CardManager;
    private _groupStorageLeveldown: AbstractLevelDOWN;

    constructor({ keyLoader, cardManager, groupStorageLeveldown }: GroupManagerConstructorParams) {
        this._privateKeyLoader = keyLoader;
        this._cardManager = cardManager;
        this._groupStorageLeveldown = groupStorageLeveldown;
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
        const localGroupStorage = await this.getLocalGroupStorage();
        const rawGroup = { info: { initiator: this.selfIdentity }, tickets: [ticket] };
        localGroupStorage.store(rawGroup);
        return group;
    }

    async pull(sessionId: string, initiatorCard: ICard) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        let cloudTickets: GroupTicket[];
        try {
            cloudTickets = await cloudTicketStorage.retrieve(
                sessionId,
                initiatorCard.identity,
                initiatorCard.publicKey,
            );
        } catch (err) {
            if (err.name === 'GroupTicketDoesntExistError') {
                const localGroupStorage = await this.getLocalGroupStorage();
                await localGroupStorage.delete(sessionId);
                throw new GroupError(
                    GroupErrorCode.RemoteGroupNotFound,
                    'Group with given id could not be found',
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
        const localGroupStorage = await this.getLocalGroupStorage();
        localGroupStorage.store({ info: { initiator }, tickets });
        return group;
    }

    async retrieve(sessionId: string, epochNumber?: number) {
        const options: RetrieveOptions = isSafeInteger(epochNumber)
            ? { epochNumber }
            : { ticketCount: MAX_EPOCHS_IN_GROUP_SESSION };

        const localGroupStorage = await this.getLocalGroupStorage();
        const rawGroup = await localGroupStorage.retrieve(sessionId, options);

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
        const localGroupStorage = await this.getLocalGroupStorage();
        await localGroupStorage.delete(sessionId);
    }

    async reAddAccess(sessionId: string, allowedCard: ICard) {
        const cloudTicketStorage = await this.getCloudTicketStorage();
        await cloudTicketStorage.reAddRecipient(sessionId, allowedCard);
    }

    private get selfIdentity() {
        return this._privateKeyLoader.identity;
    }

    private async getCloudTicketStorage() {
        const identity = this._privateKeyLoader.identity;
        const { virgilCrypto, accessTokenProvider, apiUrl } = this._privateKeyLoader.options;
        const keyPair = await this._privateKeyLoader.loadLocalKeyPair();
        if (!keyPair) {
            // TODO replace with PrivateKeyMissingError
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

    private async getLocalGroupStorage() {
        const identity = this._privateKeyLoader.identity;
        const { virgilCrypto } = this._privateKeyLoader.options;
        const keyPair = await this._privateKeyLoader.loadLocalKeyPair();
        if (!keyPair) {
            // TODO replace with PrivateKeyMissingError
            throw new RegisterRequiredError();
        }

        return new GroupLocalStorage({
            identity,
            virgilCrypto,
            keyPair,
            leveldown: this._groupStorageLeveldown,
        });
    }
}
