import { IGroupSession, ICrypto, Data, FindUsersResult } from '../types';
import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { Ticket } from './Ticket';
import { RegisterRequiredError } from '../errors';
import { ICard } from '../types';
import { CardManager } from 'virgil-sdk';
import { GroupManager } from '../GroupManager';
import { isVirgilCard, isFindUsersResult } from '../typeguards';
import { getObjectValues } from '../array';

const getCardsArray = (cardOrFindUsersResult: ICard | FindUsersResult) => {
    if (isVirgilCard(cardOrFindUsersResult)) {
        return [cardOrFindUsersResult];
    }
    if (isFindUsersResult(cardOrFindUsersResult)) {
        return getObjectValues(cardOrFindUsersResult);
    }
    return [];
};

const setDifference = <T>(a: Set<T>, b: Set<T>) => {
    return new Set([...a].filter(it => !b.has(it)));
};

export class Group {
    selfIdentity: string;
    initiator: string;
    participants: string[];

    private _session: IGroupSession;
    private _virgilCrypto: ICrypto;
    private _privateKeyLoader: PrivateKeyLoader;
    private _groupManager: GroupManager;
    private _cardManager: CardManager;

    constructor(options: {
        initiator: string;
        tickets: Ticket[];
        privateKeyLoader: PrivateKeyLoader;
        cardManager: CardManager;
        groupManager: GroupManager;
    }) {
        const sortedTickets = options.tickets
            .slice()
            .sort((a, b) => a.groupSessionMessage.epochNumber - b.groupSessionMessage.epochNumber);
        const lastTicket = sortedTickets[sortedTickets.length - 1];
        if (!lastTicket) {
            throw new Error('Failed to construct Group. Group must have at least one ticket.');
        }

        // TODO validate participants count

        this.selfIdentity = options.privateKeyLoader.identity;
        this.initiator = options.initiator;
        this.participants = lastTicket.participants;

        this._virgilCrypto = options.privateKeyLoader.options.virgilCrypto;
        this._privateKeyLoader = options.privateKeyLoader;
        this._session = this._virgilCrypto.importGroupSession(
            sortedTickets.map(t => t.groupSessionMessage.data),
        );
        this._cardManager = options.cardManager;
        this._groupManager = options.groupManager;
    }

    async encrypt(data: Data) {
        const privateKey = await this._privateKeyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new RegisterRequiredError();
        }
        return this._session.encrypt(data, privateKey);
    }

    async decrypt(encryptedData: Data, senderCard: ICard) {
        // TODO
        // 1. add third parameter - date of encryption and find card based on it
        // 2. check that sessionId matches
        // 3. check if encrypted data's epoch is newer than the current epoch
        // 4. if encrypted data's epoch is very old - create a temporary group
        // with that epoch only and decrypt with that
        // 5. Throw custom error when signature fails verification
        return this._session.decrypt(encryptedData, senderCard.publicKey);
    }

    async update() {
        const sessionId = this._session.getSessionId();
        const initiatorCards = await this._cardManager.searchCards(this.initiator);
        if (initiatorCards.length === 0) {
            throw new Error("Group owner's Virgil Card not found.");
        }
        const group = await this._groupManager.pull(sessionId, initiatorCards[0]);
        this._session = group._session;
        this.participants = group.participants;
    }

    async add(participantCard: ICard): Promise<void>;
    async add(participantCards: FindUsersResult): Promise<void>;
    async add(cardOrFindUsersResult: ICard | FindUsersResult): Promise<void> {
        // TODO check permissions
        const cardsToAdd = getCardsArray(cardOrFindUsersResult);
        if (cardsToAdd.length === 0) {
            throw new TypeError(
                'Failed to add participants. First argument must be the result of "eThree.findUsers" method',
            );
        }
        // TODO validate participants count
        const missingIdentities = setDifference(
            new Set(cardsToAdd.map(c => c.identity)),
            new Set(this.participants),
        );
        const missingCards = cardsToAdd.filter(c => missingIdentities.has(c.identity));

        await this._groupManager.addAccess(this._session.getSessionId(), missingCards);
        this.participants = [...this.participants, ...missingIdentities];
    }

    async remove(participantCard: ICard): Promise<void>;
    async remove(participantCards: FindUsersResult): Promise<void>;
    async remove(cardOrFindUsersResult: ICard | FindUsersResult): Promise<void> {
        // TODO check permissions
        const cardsToRemove = getCardsArray(cardOrFindUsersResult);
        if (cardsToRemove.length === 0) {
            throw new TypeError(
                'Failed to remove participants. First argument must be the result of "eThree.findUsers" method',
            );
        }

        const oldIdentities = new Set(this.participants);
        const newIdentities = setDifference(
            new Set(this.participants),
            new Set(cardsToRemove.map(c => c.identity)),
        );
        // TODO validate participants count
        if (newIdentities.size == 0) {
            // old and new participants are the same set of identities
            // TODO this will be part of participants count validation
            throw new Error('Cannot remove all of the group participants');
        }

        if (newIdentities.size === oldIdentities.size) {
            // none of the identities to remove is in the existing participants set
            throw new Error('Attempted to remove non-existent partipants from the group');
        }

        const newCards = await this._cardManager.searchCards([...newIdentities]);
        const epochMessage = this._session.addNewEpoch();
        const ticket = new Ticket(epochMessage, [...newIdentities]);
        await this._groupManager.store(ticket, newCards);
        newIdentities.add(this.initiator);
        this.participants = [...newIdentities];

        const removedIdentities = setDifference(oldIdentities, newIdentities);
        await this._groupManager.removeAccess(this._session.getSessionId(), [...removedIdentities]);
    }

    async reAdd(participantCard: ICard): Promise<void> {
        // TODO check permissions
        await this._groupManager.reAddAccess(this._session.getSessionId(), participantCard);
    }
}
