import { CardManager, KeyEntryAlreadyExistsError } from 'virgil-sdk';
import { AbstractLevelDOWN } from 'abstract-leveldown';

import { chunkArray, getObjectValues, hasDuplicates } from './array';
import {
    RegisterRequiredError,
    IdentityAlreadyExistsError,
    PrivateKeyAlreadyExistsError,
    MultipleCardsError,
    LookupNotFoundError,
    LookupError,
    UsersNotFoundError,
    UsersFoundWithMultipleCardsError,
    GroupError,
    GroupErrorCode,
    MissingPrivateKeyError,
} from './errors';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import { isArray, isString, isVirgilCard, isFindUsersResult, isLookupResult } from './typeguards';
import {
    Data,
    ICard,
    IKeyPair,
    IPrivateKey,
    IPublicKey,
    ICrypto,
    IAccessTokenProvider,
    IKeyEntryStorage,
    NodeBuffer,
    LookupResult,
    FindUsersResult,
} from './types';
import { MAX_IDENTITIES_TO_SEARCH, VALID_GROUP_PARTICIPANT_COUNT_RANGE } from './constants';
import { warn } from './log';
import { Group, isValidParticipantCount } from './groups/Group';
import { GroupManager } from './GroupManager';
import { getCardActiveAtMoment } from './utils/card';
import { GroupLocalStorage } from './GroupLocalStorage';

export abstract class AbstractEThree {
    /**
     * Unique identifier of current user. Received from JWT token.
     */
    identity: string;

    /**
     * Instance of implementation of [ICrypto](https://github.com/VirgilSecurity/virgil-crypto-javascript/blob/master/packages/crypto-types/index.d.ts#L23) interface.
     */
    virgilCrypto: ICrypto;

    /**
     * Instance of CardManager. Used to create cards with user public keys.
     */
    cardManager: CardManager;

    /**
     * Instance of IAccessTokenProvider implementation. Using [[getToken]] to receive JWT.
     */
    accessTokenProvider: IAccessTokenProvider;

    /**
     * Instance of IKeyEntryStorage implementation. Used for storing private keys.
     */
    keyEntryStorage: IKeyEntryStorage;

    keyPairType?: any;

    protected keyLoader: PrivateKeyLoader;
    protected inProcess = false;

    private groupManager: GroupManager;

    /**
     * @hidden
     */
    constructor(options: {
        identity: string;
        virgilCrypto: ICrypto;
        cardManager: CardManager;
        accessTokenProvider: IAccessTokenProvider;
        keyEntryStorage: IKeyEntryStorage;
        keyLoader: PrivateKeyLoader;
        groupStorageLeveldown: AbstractLevelDOWN;
        keyPairType?: any;
    }) {
        this.identity = options.identity;
        this.virgilCrypto = options.virgilCrypto;
        this.cardManager = options.cardManager;
        this.accessTokenProvider = options.accessTokenProvider;
        this.keyEntryStorage = options.keyEntryStorage;
        this.keyLoader = options.keyLoader;
        this.groupManager = new GroupManager({
            identity: options.identity,
            privateKeyLoader: options.keyLoader,
            cardManager: options.cardManager,
            groupLocalStorage: new GroupLocalStorage({
                identity: options.identity,
                leveldown: options.groupStorageLeveldown,
                virgilCrypto: options.virgilCrypto,
            }),
        });
        this.keyPairType = options.keyPairType;
    }

    /**
     * Registers current user in Virgil Cloud. Saves private key locally and uploads public key to the cloud.
     */
    async register(keyPair?: IKeyPair) {
        if (this.inProcess) {
            this.throwIllegalInvocationError('register');
        }
        this.inProcess = true;
        try {
            const [cards, privateKey] = await Promise.all<ICard[], IPrivateKey | null>([
                this.cardManager.searchCards(this.identity),
                this.keyLoader.loadLocalPrivateKey(),
            ]);
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (cards.length > 0) throw new IdentityAlreadyExistsError();
            if (privateKey) await this.keyLoader.resetLocalPrivateKey();
            await this.publishCardThenSavePrivateKeyLocal({ keyPair });
        } finally {
            this.inProcess = false;
        }
    }

    /**
     * Generates a new private key and saves locally. Replaces old public key with new one in Cloud.
     * Used in case if old private key is lost.
     */
    async rotatePrivateKey(): Promise<void> {
        if (this.inProcess) {
            this.throwIllegalInvocationError('rotatePrivateKey');
        }
        this.inProcess = true;
        try {
            const [cards, privateKey] = await Promise.all<ICard[], IPrivateKey | null>([
                this.cardManager.searchCards(this.identity),
                this.keyLoader.loadLocalPrivateKey(),
            ]);
            if (cards.length === 0) throw new RegisterRequiredError();
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (privateKey) throw new PrivateKeyAlreadyExistsError();
            await this.publishCardThenSavePrivateKeyLocal({ previousCard: cards[0] });
        } finally {
            this.inProcess = false;
        }
    }

    /**
     * Downloads private key from Virgil Cloud. Use [[backupPrivateKey]] to upload the key first.
     * @param pwd User password for access to Virgil Keyknox Storage.
     * @param keyName Is a name for the key backup in the cloud.
     */
    async restorePrivateKey(pwd: string, keyName?: string): Promise<void> {
        try {
            await this.keyLoader.restorePrivateKey(pwd, keyName);
        } catch (e) {
            if (e instanceof KeyEntryAlreadyExistsError) {
                throw new PrivateKeyAlreadyExistsError();
            }
            throw e;
        }
    }

    /**
     * Deletes local private key from key storage. Make sure [[backupPrivateKey]] method was called
     * first.
     */
    async cleanup() {
        await this.keyLoader.resetLocalPrivateKey();
        await this.onPrivateKeyDeleted();
    }

    /**
     * Delete private key saved in Virgil Keyknox Storage.
     * @returns {Promise<void>} - Promise that is resolved if everything went fine.
     */
    async resetPrivateKeyBackup(): Promise<void>;
    /**
     * Delete private key saved in Virgil Keyknox Storage.
     *
     * @deprecated and will be removed in next major release.
     *
     * @param {string} pwd - User password for access to Virgil Keyknox Storage.
     * @returns {Promise<void>} - Promise that is resolved if everything went fine.
     */
    async resetPrivateKeyBackup(pwd: string): Promise<void>;
    async resetPrivateKeyBackup(pwd?: string) {
        if (!pwd) {
            return await this.keyLoader.resetAll();
        }
        warn(
            `'resetPrivateKeyBackup(pwd: string)' was deprecated. Please use 'resetPrivateKeyBackup()' instead.`,
        );
        return this.keyLoader.resetPrivateKeyBackup(pwd);
    }

    /**
     * Delete private key saved in Virgil Keyknox Storage.
     * @returns {Promise<void>} - Promise that is resolved if everything went fine.
     */
    async resetPrivateKeyBackupWithKeyName(keyName: string): Promise<void> {
        return this.keyLoader.resetPrivateKeyBackupWithKeyName(keyName);
    }

    /**
     * Encrypts and signs the message for the current user.
     * @param {Data} message - Message to sign and encrypt.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise
     */
    async encrypt(message: Data): Promise<NodeBuffer | string>;
    /**
     * Encrypts and signs the message for the current user and a single recipient user.
     * @param {Data} message - Message to sign and encrypt.
     * @param {ICard} card - Virgil Card of the encrypted message recipient.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async encrypt(message: Data, card: ICard): Promise<NodeBuffer | string>;
    /**
     * Encrypts and signs the message for the current user and multiple recipient users.
     * @param {Data} message - Message to sign and encrypt.
     * @param {FindUsersResult} users - Result of the {@link AbstractEThree.findUsers} method.
     * Specifies multiple recipients.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async encrypt(message: Data, users: FindUsersResult): Promise<NodeBuffer | string>;
    /**
     * Encrypts and signs the message for the current user and a single recipient user.
     *
     * Use the overload that accepts `ICard` object instead.
     *
     * @param {Data} message - Message to sign and encrypt.
     * @param {IPublicKey} publicKey - Public key of the encrypted message recipient.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async encrypt(message: Data, publicKey: IPublicKey): Promise<NodeBuffer | string>;
    /**
     * Encrypts and signs the message for the current user and multiple recipient users.
     *
     * @deprecated and will be removed in next major release.
     *
     * Use the overload that accepts `FindUsersResult` object instead.
     *
     *
     * @param {Data} message - Message to sign and encrypt.
     * @param {LookupResult} users - Result of the {@link AbstractEThree.lookupPublicKeys} method.
     * Specifies multiple recipients.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async encrypt(message: Data, publicKeys: LookupResult): Promise<NodeBuffer | string>;
    async encrypt(
        message: Data,
        recipients?: ICard | FindUsersResult | IPublicKey | LookupResult,
    ): Promise<NodeBuffer | string> {
        const shouldReturnString = isString(message);

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }

        const publicKeys = this.getPublicKeysForEncryption(privateKey, recipients);
        if (!publicKeys) {
            throw new TypeError(
                'Could not get public keys from the second argument.\n' +
                    'Make sure you pass the resolved value of "EThree.findUsers" or "EThree.lookupPublicKeys" methods ' +
                    'when encrypting for other users, or nothing when encrypting for the current user only.',
            );
        }

        const res = this.virgilCrypto.signThenEncrypt(message, privateKey, publicKeys);
        if (shouldReturnString) {
            return res.toString('base64');
        }
        return res;
    }

    /**
     * Decrypts and verifies the data encrypted by the current user for the current user.
     * @param {Data} message - Message to decrypt
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async decrypt(message: Data): Promise<NodeBuffer | string>;
    /**
     * Decrypts and verifies the data encrypted by the user identified by `senderCard` for the
     * current user.
     * @param {Data} message - Message to decrypt
     * @param {ICard} senderCard - Virgil Card of the user who encrypted and signed the message.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async decrypt(message: Data, senderCard: ICard): Promise<NodeBuffer | string>;
    /**
     * Decrypts and verifies the data encrypted by the user identified by `senderCard` for the
     * current user. If the sender had ever rotated their keys (e.g. by using the
     * {@link EThree.rotatePrivateKey} method), then the `encryptedAt` date is used to find the
     * public key that was current at the time of encryption.
     * @param {Data} message - Message to decrypt
     * @param {ICard} senderCard - Virgil Card of the user who encrypted and signed the message.
     * @param {Date} encryptedAt - The date the message was encrypted on.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async decrypt(
        message: Data,
        senderCard: ICard,
        encryptedAt: Date,
    ): Promise<NodeBuffer | string>;
    /**
     * Decrypts and verifies the data encrypted by the user identified by `senderPublicKey` for the
     * current user.
     *
     * @deprecated and will be removed in next major release.
     *
     * Use the overload that accepts Virgil Card object instead.
     *
     * @param {Data} message - Message to decrypt
     * @param {IPublicKey} senderPublicKey - Public key of the user who encrypted and signed the message.
     * @returns {Promise<NodeBuffer | string>} Promise that is that resolves to a string if `message`
     * was a string and `Buffer` otherwise.
     */
    async decrypt(message: Data, senderPublicKey: IPublicKey): Promise<NodeBuffer | string>;
    async decrypt(
        message: Data,
        senderCardOrPublicKey?: ICard | IPublicKey,
        encryptedAt?: Date,
    ): Promise<NodeBuffer | string> {
        const shouldReturnString = isString(message);

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }

        const senderPublicKey = this.getPublicKeyForVerification(
            privateKey,
            senderCardOrPublicKey,
            encryptedAt,
        );
        if (!senderPublicKey) {
            throw new TypeError(
                'Could not get public key from the second argument.' +
                    'Expected a Virgil Card or a Public Key object. Got ' +
                    typeof senderCardOrPublicKey,
            );
        }

        const res = this.virgilCrypto.decryptThenVerify(message, privateKey, senderPublicKey);
        if (shouldReturnString) {
            return res.toString('utf8');
        }
        return res;
    }

    authEncrypt(message: Data): Promise<NodeBuffer | string>;
    authEncrypt(message: Data, publicKey: IPublicKey): Promise<NodeBuffer | string>;
    authEncrypt(message: Data, card: ICard): Promise<NodeBuffer | string>;
    authEncrypt(message: Data, users: FindUsersResult): Promise<NodeBuffer | string>;
    async authEncrypt(arg0: Data, arg1?: IPublicKey | ICard | FindUsersResult) {
        const returnString = isString(arg0);
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }
        const publicKeys = this.getPublicKeysForEncryption(privateKey, arg1);
        if (!publicKeys) {
            throw new TypeError(
                'Could not get public keys from the second argument.\n' +
                    'Make sure you pass the resolved value of the "EThree.findUsers" method ' +
                    'when encrypting for other users, or nothing when encrypting for the current user only.',
            );
        }
        const encryptedData = this.virgilCrypto.signAndEncrypt(arg0, privateKey, publicKeys, true);
        if (returnString) {
            return encryptedData.toString('base64');
        }
        return encryptedData;
    }

    authDecrypt(message: Data): Promise<NodeBuffer | string>;
    authDecrypt(message: Data, publicKey: IPublicKey): Promise<NodeBuffer | string>;
    authDecrypt(message: Data, card: ICard, encryptedAt?: Date): Promise<NodeBuffer | string>;
    async authDecrypt(arg0: Data, arg1?: ICard | IPublicKey, arg2?: Date) {
        const returnString = isString(arg0);
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }
        const senderPublicKey = this.getPublicKeyForVerification(privateKey, arg1, arg2);
        if (!senderPublicKey) {
            throw new TypeError(
                'Could not get public key from the second argument.' +
                    'Expected a Virgil Card or a Public Key object. Got ' +
                    typeof arg1,
            );
        }
        const decryptedData = this.virgilCrypto.decryptAndVerify(arg0, privateKey, senderPublicKey);
        if (returnString) {
            return decryptedData.toString('utf8');
        }
        return decryptedData;
    }

    /**
     * Finds Virgil Card for user identity registered on Virgil Cloud.
     *
     * @param {string} - Identity of the user to find the Virgil Card of.
     *
     * @returns {Promise<ICard>} - Promise that resolves to the Virgil Card object.
     *
     * @throws {UsersNotFoundError} in case the Virgil Card wasn't found for the
     * given identity.
     *
     * @throws {UsersFoundWithMultipleCardsError} in case the given user has more than
     * one Virgil Card, which is not allowed with E3kit.
     */
    async findUsers(identity: string): Promise<ICard>;
    /**
     * Finds Virgil Cards for user identities registered on Virgil Cloud.
     *
     * @param {string[]} - A list of user identities to find the Virgil Cards of.
     *
     * @returns {Promise<FindUsersResult>} - Promise that resolves to a hash with
     * identities as keys and Virgil Card objects as values.
     *
     * @throws {UsersNotFoundError} in case the Virgil Card wasn't found for any one of the
     * given identities.
     *
     * @throws {UsersFoundWithMultipleCardsError} in case any one of the given users have
     * more than one Virgil Card, which is not allowed with E3kit.
     */
    async findUsers(identities: string[]): Promise<FindUsersResult>;
    async findUsers(identities: string[] | string): Promise<ICard | FindUsersResult> {
        if (!identities) {
            throw new TypeError('Argument "identities" is required');
        }

        let identitySet;
        if (typeof identities === 'string') {
            identitySet = new Set([identities]);
        } else if (isArray(identities)) {
            identitySet = new Set(identities);
        } else {
            throw new TypeError(
                `Expected "identities" to be a string or an array of strings. Got: "${typeof identities}"`,
            );
        }

        if (identitySet.size === 0) {
            throw new TypeError('"identities" array must not be empty');
        }

        const result: FindUsersResult = Object.create({});
        const identitiesWithMultipleCards: Set<string> = new Set();

        const identityChunks = chunkArray(Array.from(identitySet), MAX_IDENTITIES_TO_SEARCH);
        for (const identityChunk of identityChunks) {
            const cards = await this.cardManager.searchCards(identityChunk);
            for (const card of cards) {
                if (result[card.identity]) {
                    identitiesWithMultipleCards.add(card.identity);
                }
                result[card.identity] = card;
            }
        }

        const identitiesFound = new Set(Object.keys(result));
        const identitiesNotFound = new Set([...identitySet].filter(i => !identitiesFound.has(i)));
        if (identitiesNotFound.size > 0) {
            throw new UsersNotFoundError([...identitiesNotFound]);
        }

        if (identitiesWithMultipleCards.size > 0) {
            throw new UsersFoundWithMultipleCardsError([...identitiesWithMultipleCards]);
        }

        if (isArray(identities)) {
            return result;
        }

        return result[identities];
    }

    /**
     * Finds public key for user identity registered on Virgil Cloud.
     *
     * @deprecated and will be removed in next major release.
     *
     * Use the {@link EThree.findUsers} instead, which returns Virgil Cards instead
     * of just the public keys. You can get a public key out of the Virgil Card object
     * via the `publicKey` property.
     *
     * @param {string} - Identity of the user to lookup the public key of.
     *
     * @returns {Promise<IPublicKey>} - Promise that resolves to a public key object.
     */
    async lookupPublicKeys(identity: string): Promise<IPublicKey>;
    /**
     * Finds public keys for user identities registered on Virgil Cloud.
     *
     * @deprecated and will be removed in next major release.
     *
     * Use the {@link EThree.findUsers} instead, which returns Virgil Cards instead
     * of just the public keys. You can get a public key out of the Virgil Card object
     * via the `publicKey` property.
     *
     * @param {string[]} - A list of user identities to lookup the public keys of.
     *
     * @returns {Promise<LookupResult | IPublicKey>} - Promise that resolves to a hash with
     * identities as keys and public key objects as values.
     */
    async lookupPublicKeys(identities: string[]): Promise<LookupResult>;
    async lookupPublicKeys(identities: string[] | string): Promise<LookupResult | IPublicKey> {
        warn('Warning! Method "lookupPublicKeys" has been deprecated, use "findUsers" instead');
        const argument = isArray(identities) ? identities : [identities];
        if (argument.length === 0) {
            throw new Error('Array should be non empty');
        }
        if (hasDuplicates(argument)) {
            throw new Error('Identities in array should be unique');
        }

        const cards = await this.cardManager.searchCards(argument);

        const result: LookupResult = {};
        const resultWithErrors: { [identity: string]: Error } = {};

        for (const identity of argument) {
            const filteredCards = cards.filter(card => card.identity === identity);
            if (filteredCards.length === 0) {
                resultWithErrors[identity] = new LookupNotFoundError(identity);
            } else if (filteredCards.length > 1) {
                resultWithErrors[identity] = new MultipleCardsError(identity);
            } else {
                result[identity] = filteredCards[0].publicKey;
            }
        }

        if (getObjectValues(resultWithErrors).length !== 0) {
            throw new LookupError({ ...resultWithErrors, ...result });
        }

        if (Array.isArray(identities)) {
            return result;
        }

        return result[identities];
    }

    /**
     * Changes password for access to current user private key backup.
     * @param oldPwd users old password
     * @param newPwd users new password
     */
    async changePassword(oldPwd: string, newPwd: string, keyName?: string) {
        return await this.keyLoader.changePassword(oldPwd, newPwd, keyName);
    }

    /**
     * Uploads current user private key to Virgil Keyknox Storage.
     * @param pwd User password for access to Virgil Keyknox Storage
     * @param keyName Is a name that would be used to store backup in the cloud.
     */
    async backupPrivateKey(pwd: string, keyName?: string): Promise<void> {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) {
            throw new MissingPrivateKeyError();
        }
        await this.keyLoader.savePrivateKeyRemote(privateKey, pwd, keyName);
        return;
    }

    /**
     * Checks if current user has private key saved locally.
     */
    hasLocalPrivateKey(): Promise<boolean> {
        return this.keyLoader.hasPrivateKey();
    }

    /**
     * Unregister current user. Revokes public key in Virgil Cloud and deletes local private key.
     *
     * @throws {RegisterRequiredError} If current user is not registered (i.e.
     *                                 there is no Virgil Card for this identity)
     * @throws {MultipleCardsError} If there is more than one Virgil Card for this identity
     */
    async unregister(): Promise<void> {
        if (this.inProcess) {
            this.throwIllegalInvocationError('unregister');
        }
        this.inProcess = true;
        try {
            const cards = await this.cardManager.searchCards(this.identity);
            if (cards.length === 0) {
                throw new RegisterRequiredError();
            }
            for (const card of cards) {
                await this.cardManager.revokeCard(card.id);
            }
            await this.keyLoader.resetLocalPrivateKey();
            await this.onPrivateKeyDeleted();
        } finally {
            this.inProcess = false;
        }
    }

    async createGroup(groupId: Data): Promise<Group>;
    async createGroup(groupId: Data, participant: ICard): Promise<Group>;
    async createGroup(groupId: Data, participants: FindUsersResult): Promise<Group>;
    async createGroup(groupId: Data, participants?: ICard | FindUsersResult): Promise<Group> {
        let participantIdentities = new Set<string>();
        let participantCards: ICard[] = [];
        if (isVirgilCard(participants)) {
            participantIdentities = new Set([participants.identity]);
            participantCards = [participants];
        } else if (isFindUsersResult(participants)) {
            participantIdentities = new Set(Object.keys(participants));
            participantCards = getObjectValues(participants);
        } else if (typeof participants !== 'undefined') {
            throw new TypeError(
                'Expected participants to be the result of "findUsers" method call or to be "typeof undefined"',
            );
        }
        participantIdentities.add(this.identity);
        if (!isValidParticipantCount(participantIdentities.size)) {
            throw new GroupError(
                GroupErrorCode.InvalidParticipantsCount,
                `Cannot create group with ${participantIdentities.size} participant(s). Group can have ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[0]} to ${VALID_GROUP_PARTICIPANT_COUNT_RANGE[1]} participants.`,
            );
        }
        const groupSession = this.virgilCrypto.generateGroupSession(groupId);
        const ticket = {
            groupSessionMessage: {
                epochNumber: groupSession.getCurrentEpochNumber(),
                sessionId: groupSession.getSessionId(),
                data: groupSession.export()[0].toString('base64'),
            },
            participants: [...participantIdentities],
        };
        return await this.groupManager.store(ticket, participantCards);
    }

    async loadGroup(groupId: Data, initiatorCard: ICard) {
        const sessionId = this.virgilCrypto.calculateGroupSessionId(groupId);
        return await this.groupManager.pull(sessionId, initiatorCard);
    }

    async getGroup(groupId: Data) {
        const sessionId = this.virgilCrypto.calculateGroupSessionId(groupId);
        return await this.groupManager.retrieve(sessionId);
    }

    async deleteGroup(groupId: Data) {
        const sessionId = this.virgilCrypto.calculateGroupSessionId(groupId);
        await this.groupManager.delete(sessionId);
    }

    /**
     * @hidden
     */
    private async publishCardThenSavePrivateKeyLocal(options: {
        keyPair?: IKeyPair;
        previousCard?: ICard;
    }) {
        const { keyPair, previousCard } = options;
        const myKeyPair = keyPair || this.virgilCrypto.generateKeys(this.keyPairType);
        const card = await this.cardManager.publishCard({
            privateKey: myKeyPair.privateKey,
            publicKey: myKeyPair.publicKey,
            previousCardId: previousCard ? previousCard.id : undefined,
        });
        await this.keyLoader.savePrivateKeyLocal(myKeyPair.privateKey);
        return {
            card,
            keyPair: myKeyPair,
        };
    }

    /**
     * @hidden
     */
    private isOwnPublicKeyIncluded(ownPublicKey: IPublicKey, publicKeys: IPublicKey[]) {
        const selfPublicKey = this.virgilCrypto.exportPublicKey(ownPublicKey).toString('base64');

        const stringKeys = publicKeys.map(key =>
            this.virgilCrypto.exportPublicKey(key).toString('base64'),
        );
        return stringKeys.some(key => key === selfPublicKey);
    }

    private throwIllegalInvocationError(method: string) {
        throw new Error(`Calling ${method} two or more times in a row is not allowed.`);
    }

    /**
     * @hidden
     */
    private addOwnPublicKey(privateKey: IPrivateKey, publicKeys: IPublicKey[]): void {
        const ownPublicKey = this.virgilCrypto.extractPublicKey(privateKey);
        if (!this.isOwnPublicKeyIncluded(ownPublicKey, publicKeys)) {
            publicKeys.push(ownPublicKey);
        }
    }

    /**
     * @hidden
     */
    private async onPrivateKeyDeleted() {
        await this.groupManager.cleanup();
    }

    /**
     * @hidden
     */
    protected getPublicKeysForEncryption(
        ownPrivateKey: IPrivateKey,
        recipients?: ICard | FindUsersResult | IPublicKey | LookupResult,
    ): IPublicKey[] | null {
        let publicKeys: IPublicKey[];
        if (recipients == null) {
            publicKeys = [];
        } else if (isVirgilCard(recipients)) {
            publicKeys = [recipients.publicKey];
        } else if (isFindUsersResult(recipients)) {
            publicKeys = getObjectValues(recipients).map((card: ICard) => card.publicKey);
        } else if (this.isPublicKey(recipients)) {
            warn(
                'Warning! Calling `encrypt` with the result of `lookupPublicKeys` method has been deprecated. ' +
                    'Please use the result of `findUsers` call instead',
            );
            publicKeys = [recipients as IPublicKey];
        } else if (isLookupResult(recipients, this.isPublicKey.bind(this))) {
            warn(
                'Warning! Calling `encrypt` with the result of `lookupPublicKeys` method has been deprecated. ' +
                    'Please use the result of `findUsers` call instead',
            );
            publicKeys = getObjectValues(recipients).map((publicKey: IPublicKey) => publicKey);
        } else {
            return null;
        }

        this.addOwnPublicKey(ownPrivateKey, publicKeys);
        return publicKeys;
    }

    /**
     * @hidden
     */
    protected getPublicKeyForVerification(
        ownPrivateKey: IPrivateKey,
        senderCardOrPublicKey?: ICard | IPublicKey,
        encryptedAt?: Date | number,
    ): IPublicKey | null {
        if (senderCardOrPublicKey == null) {
            return this.virgilCrypto.extractPublicKey(ownPrivateKey);
        }

        if (isVirgilCard(senderCardOrPublicKey)) {
            return encryptedAt
                ? getCardActiveAtMoment(senderCardOrPublicKey, encryptedAt).publicKey
                : senderCardOrPublicKey.publicKey;
        }

        if (this.isPublicKey(senderCardOrPublicKey)) {
            return senderCardOrPublicKey;
        }

        return null;
    }

    /**
     * @hidden
     */
    protected abstract isPublicKey(publicKey: any): boolean;
}
