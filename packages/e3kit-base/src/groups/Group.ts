import { IGroupSession, ICrypto, Data, FindUsersResult, NodeBuffer, Ticket } from '../types';
import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { GroupError, GroupErrorCode, UsersNotFoundError, MissingPrivateKeyError } from '../errors';
import { ICard } from '../types';
import { CardManager } from 'virgil-sdk';
import { GroupManager } from '../GroupManager';
import { isVirgilCard, isString } from '../typeguards';
import { VALID_GROUP_PARTICIPANT_COUNT_RANGE, MAX_EPOCHS_IN_GROUP_SESSION } from '../constants';
import { getCardActiveAtMoment, getCardsArray } from '../utils/card';
import { isValidDate } from '../utils/date';
import { isNumberInRange } from '../utils/number';
import { setDifference } from '../utils/set';

export const isValidParticipantCount = (count: number) => {
    return isNumberInRange(count, VALID_GROUP_PARTICIPANT_COUNT_RANGE);
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
            throw new GroupError(
                GroupErrorCode.InvalidGroup,
                'Failed to construct Group. Group must have at least one ticket.',
            );
        }

        if (!isValidParticipantCount(lastTicket.participants.length)) {
            throw new GroupError(
                GroupErrorCode.InvalidParticipantsCount,
                `Cannot initialize group with ${lastTicket.participants.length} participant(s). Group can have ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[0]} to ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[1]} participants.`,
            );
        }

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
        const shouldReturnString = isString(data);
        const privateKey = await this._privateKeyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }

        const encrypted = this._session.encrypt(data, privateKey);
        return shouldReturnString ? encrypted.toString('base64') : encrypted;
    }

    async decrypt(
        encryptedData: Data,
        senderCard: ICard,
        encryptedOn?: Date | number,
    ): Promise<NodeBuffer | string> {
        const {
            sessionId: messageSessionId,
            epochNumber: messageEpochNumber,
            data: messageData,
        } = this._session.parseMessage(encryptedData);

        if (!isVirgilCard(senderCard)) {
            throw new TypeError(
                'Cannot decrypt data. Second argument must be a Virgil Card object.',
            );
        }

        const shouldReturnString = isString(encryptedData);

        let actualCard;
        if (encryptedOn) {
            const encryptedOnDate = new Date(encryptedOn);
            if (!isValidDate(encryptedOnDate)) {
                throw new TypeError(
                    'Cannot decrypt data. Third argument, if provided, must be a Date or a timestamp',
                );
            }
            actualCard = getCardActiveAtMoment(senderCard, encryptedOnDate);
            if (!actualCard) {
                throw new Error(
                    'The given sender Virgil Card is newer than the encrypted data.' +
                        'This may happen if they un-registered and registered again with the same identity.' +
                        'Try loading their Virgil Card by its ID.',
                );
            }
        } else {
            actualCard = senderCard;
        }

        if (messageSessionId !== this._session.getSessionId()) {
            throw new GroupError(
                GroupErrorCode.MessageNotFromThisGroup,
                'The given message was encrypted for different group',
            );
        }

        if (messageEpochNumber > this._session.getCurrentEpochNumber()) {
            throw new GroupError(
                GroupErrorCode.GroupIsOutdated,
                'This group is out of date. Call "group.update()" or "e3kitInstance.loadGroup()" to be able to decrypt this message',
            );
        }

        try {
            let decrypted;
            if (
                this._session.getCurrentEpochNumber() - messageEpochNumber <
                MAX_EPOCHS_IN_GROUP_SESSION
            ) {
                decrypted = this._session.decrypt(messageData, actualCard.publicKey);
            } else {
                const tempGroup = await this._groupManager.retrieve(
                    messageSessionId,
                    messageEpochNumber,
                );
                if (!tempGroup) {
                    throw new GroupError(
                        GroupErrorCode.LocalGroupNotFound,
                        `Group with given id was not found in local storage. Try to load it first.`,
                    );
                }
                decrypted = tempGroup.decrypt(encryptedData, actualCard);
            }
            return shouldReturnString ? decrypted.toString('utf8') : decrypted;
        } catch (err) {
            if (err.name === 'FoundationError' && /Invalid signature/.test(err.message)) {
                throw new GroupError(
                    GroupErrorCode.DataVerificationFailed,
                    "Verification of message integrity failed. This may be caused by the sender's public key rotation." +
                        'Try looking it up again with "e3kitInstance.findUsers()"',
                );
            }
            throw err;
        }
    }

    async update() {
        const sessionId = this._session.getSessionId();
        const initiatorCards = await this._cardManager.searchCards(this.initiator);
        if (initiatorCards.length === 0) {
            throw new UsersNotFoundError([this.initiator]);
        }
        const group = await this._groupManager.pull(sessionId, initiatorCards[0]);
        this._session = group._session;
        this.participants = group.participants;
    }

    async add(participantCard: ICard): Promise<void>;
    async add(participantCards: FindUsersResult): Promise<void>;
    async add(cardOrFindUsersResult: ICard | FindUsersResult): Promise<void> {
        const cardsToAdd = getCardsArray(cardOrFindUsersResult);
        if (cardsToAdd.length === 0) {
            throw new TypeError(
                'Failed to add participants. First argument must be the result of "eThree.findUsers" method',
            );
        }

        if (!this.isEditable()) {
            throw new GroupError(
                GroupErrorCode.PermissionDenied,
                'Only group initiator can add participants to the group',
            );
        }

        const missingIdentities = setDifference(
            new Set(cardsToAdd.map(c => c.identity)),
            new Set(this.participants),
        );
        const newParicipantCount = missingIdentities.size + this.participants.length;
        if (!isValidParticipantCount(newParicipantCount)) {
            throw new GroupError(
                GroupErrorCode.InvalidChangeParticipants,
                `Cannot add ${missingIdentities.size} participant(s) to the group that has ${this.participants.length} participants. Group can have ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[0]} to ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[1]} participants.`,
            );
        }
        const missingCards = cardsToAdd.filter(c => missingIdentities.has(c.identity));

        await this._groupManager.addAccess(this._session.getSessionId(), missingCards);
        this.participants = [...this.participants, ...missingIdentities];
    }

    async remove(participantCard: ICard): Promise<void>;
    async remove(participantCards: FindUsersResult): Promise<void>;
    async remove(cardOrFindUsersResult: ICard | FindUsersResult): Promise<void> {
        const cardsToRemove = getCardsArray(cardOrFindUsersResult);
        if (cardsToRemove.length === 0) {
            throw new TypeError(
                'Failed to remove participants. First argument must be the result of "eThree.findUsers" method',
            );
        }

        if (!this.isEditable()) {
            throw new GroupError(
                GroupErrorCode.PermissionDenied,
                'Only group initiator can remove participants from the group',
            );
        }

        const oldIdentities = new Set(this.participants);
        const newIdentities = setDifference(
            new Set(this.participants),
            new Set(cardsToRemove.map(c => c.identity)),
        );

        if (!isValidParticipantCount(newIdentities.size)) {
            throw new GroupError(
                GroupErrorCode.InvalidChangeParticipants,
                `Cannot remove ${oldIdentities.size -
                    newIdentities.size} participant(s) from the group that has ${
                    oldIdentities.size
                } participants. Group can have ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[0]} to ${
                    VALID_GROUP_PARTICIPANT_COUNT_RANGE[1]
                } participants.`,
            );
        }

        if (newIdentities.size === oldIdentities.size) {
            // none of the identities to remove is in the existing participants set
            throw new GroupError(
                GroupErrorCode.InvalidChangeParticipants,
                'Attempted to remove non-existent group participants',
            );
        }

        const newCards = await this._cardManager.searchCards([...newIdentities]);
        const epochMessage = this._session.addNewEpoch();
        const ticket = { groupSessionMessage: epochMessage, participants: [...newIdentities] };
        await this._groupManager.store(ticket, newCards);
        newIdentities.add(this.initiator);
        this.participants = [...newIdentities];

        const removedIdentities = setDifference(oldIdentities, newIdentities);
        await this._groupManager.removeAccess(this._session.getSessionId(), [...removedIdentities]);
    }

    async reAdd(participantCard: ICard): Promise<void> {
        if (!isVirgilCard(participantCard)) {
            throw new TypeError(
                'Failed to re-add participant. First argument must be a Virgil Card object',
            );
        }
        if (!this.isEditable()) {
            throw new GroupError(
                GroupErrorCode.PermissionDenied,
                'Only group initiator can add or remove participants from the group',
            );
        }

        await this._groupManager.reAddAccess(this._session.getSessionId(), participantCard);
    }

    isEditable() {
        return this.initiator === this.selfIdentity;
    }
}
