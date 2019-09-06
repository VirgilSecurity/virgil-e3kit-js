import { CardManager, KeyEntryAlreadyExistsError, VirgilCardVerifier } from 'virgil-sdk';

import { getObjectValues, hasDuplicates } from './utils/array';
import { isArray, isString } from './utils/typeguards';
import {
    RegisterRequiredError,
    IdentityAlreadyExistsError,
    PrivateKeyAlreadyExistsError,
    MultipleCardsError,
    LookupNotFoundError,
    LookupError,
    DUPLICATE_IDENTITIES,
    EMPTY_ARRAY,
    throwIllegalInvocationError,
} from './errors';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import {
    Data,
    ICard,
    IKeyPair,
    IPrivateKey,
    IPublicKey,
    ICrypto,
    ICardCrypto,
    IAccessTokenProvider,
    IKeyEntryStorage,
    LookupResult,
    EncryptPublicKeyArg,
} from './types';

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
     * Instance of implementation of [ICardCrypto](https://github.com/VirgilSecurity/virgil-crypto-javascript/blob/master/packages/crypto-types/index.d.ts#L66) interface.
     */
    cardCrypto: ICardCrypto;

    /**
     * Instance of VirgilCardVerifier.
     */
    cardVerifier: VirgilCardVerifier;

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

    protected keyLoader: PrivateKeyLoader;
    protected inProcess: boolean = false;

    /**
     * @hidden
     */
    constructor(options: {
        identity: string;
        virgilCrypto: ICrypto;
        cardCrypto: ICardCrypto;
        cardVerifier: VirgilCardVerifier;
        cardManager: CardManager;
        accessTokenProvider: IAccessTokenProvider;
        keyEntryStorage: IKeyEntryStorage;
        keyLoader: PrivateKeyLoader;
    }) {
        this.identity = options.identity;
        this.virgilCrypto = options.virgilCrypto;
        this.cardCrypto = options.cardCrypto;
        this.cardVerifier = options.cardVerifier;
        this.cardManager = options.cardManager;
        this.accessTokenProvider = options.accessTokenProvider;
        this.keyEntryStorage = options.keyEntryStorage;
        this.keyLoader = options.keyLoader;
    }

    /**
     * Register current user in Virgil Cloud. Saves private key locally and uploads public key to cloud.
     */
    async register(keyPair?: IKeyPair) {
        if (this.inProcess) throwIllegalInvocationError('register');
        this.inProcess = true;
        try {
            const [cards, privateKey] = await Promise.all([
                this.cardManager.searchCards(this.identity),
                this.keyLoader.loadLocalPrivateKey(),
            ]);
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (cards.length > 0) throw new IdentityAlreadyExistsError();
            if (privateKey && cards.length === 0) await this.keyLoader.resetLocalPrivateKey();
            const myKeyPair = keyPair || this.virgilCrypto.generateKeys();
            await this.publishCard(myKeyPair);
            await this.keyLoader.savePrivateKeyLocal(myKeyPair.privateKey);
        } finally {
            this.inProcess = false;
        }
    }

    /**
     * Generates a new private key and saves locally. Replaces old public key with new one in Cloud.
     * Used in case if old private key is lost.
     */
    async rotatePrivateKey(): Promise<void> {
        if (this.inProcess) throwIllegalInvocationError('rotatePrivateKey');
        this.inProcess = true;
        try {
            const [cards, privateKey] = await Promise.all([
                this.cardManager.searchCards(this.identity),
                this.keyLoader.loadLocalPrivateKey(),
            ]);
            if (cards.length === 0) throw new RegisterRequiredError();
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (privateKey) throw new PrivateKeyAlreadyExistsError();
            const keyPair = this.virgilCrypto.generateKeys();
            await this.publishCard(keyPair, cards[0].id);
            await this.keyLoader.savePrivateKeyLocal(keyPair.privateKey);
        } finally {
            this.inProcess = false;
        }
    }

    /**
     * Downloads private key from Virgil Cloud. Use [[backupPrivateKey]] to upload the key first.
     * @param pwd User password for access to Virgil Keyknox Storage.
     */
    async restorePrivateKey(pwd: string): Promise<void> {
        try {
            await this.keyLoader.restorePrivateKey(pwd);
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
    }

    /**
     * Delete private key saved in Virgil Keyknox Storage.
     * @param pwd User password for access to Virgil Keyknox Storage. If password omitted resets all
     * Keyknox storage.
     */
    async resetPrivateKeyBackup(pwd?: string) {
        if (!pwd) return await this.keyLoader.resetAll();
        return this.keyLoader.resetPrivateKeyBackup(pwd);
    }

    /**
     * Encrypts and signs data for recipient public key or `LookupResult` dictionary for multiple recipients.
     * If there is no recipient and message encrypted for the current user, omit public key.
     */
    async encrypt(message: Data, publicKeys?: EncryptPublicKeyArg): Promise<Data> {
        const isMessageString = isString(message);

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeysArray = this.addOwnPublicKey(privateKey, publicKeys);

        const res: Data = this.virgilCrypto.signThenEncrypt(message, privateKey, publicKeysArray);
        if (isMessageString) return res.toString('base64');
        return res;
    }

    /**
     * Decrypts data and verify signature of sender by his public key. If message is self-encrypted,
     * omit public key parameter.
     */
    async decrypt(message: Data, publicKey?: IPublicKey): Promise<Data> {
        const isMessageString = isString(message);

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        if (!publicKey) publicKey = this.virgilCrypto.extractPublicKey(privateKey);

        const res = this.virgilCrypto.decryptThenVerify(message, privateKey, publicKey);
        if (isMessageString) return res.toString('utf8') as string;
        return res;
    }

    /**
     * Find public keys for user identities registered on Virgil Cloud.
     */
    async lookupPublicKeys(identity: string): Promise<IPublicKey>;
    async lookupPublicKeys(identities: string[]): Promise<LookupResult>;
    async lookupPublicKeys(identities: string[] | string): Promise<LookupResult | IPublicKey> {
        const argument = isArray(identities) ? identities : [identities];
        if (argument.length === 0) throw new Error(EMPTY_ARRAY);
        if (hasDuplicates(argument)) throw new Error(DUPLICATE_IDENTITIES);

        const cards = await this.cardManager.searchCards(argument);

        let result: LookupResult = {},
            resultWithErrors: { [identity: string]: Error } = {};

        for (let identity of argument) {
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

        if (Array.isArray(identities)) return result;

        return result[identities];
    }

    /**
     * Changes password for access to current user private key backup.
     * @param oldPwd users old password
     * @param newPwd users new password
     */
    async changePassword(oldPwd: string, newPwd: string) {
        return await this.keyLoader.changePassword(oldPwd, newPwd);
    }

    /**
     * Uploads current user private key to Virgil Keyknox Storage.
     */
    async backupPrivateKey(pwd: string): Promise<void> {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        await this.keyLoader.savePrivateKeyRemote(privateKey, pwd);
        return;
    }

    /**
     * Checks if current user has private key saved locally.
     */
    hasLocalPrivateKey(): Promise<Boolean> {
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
        if (this.inProcess) throwIllegalInvocationError('unregister');
        this.inProcess = true;
        try {
            const cards = await this.cardManager.searchCards(this.identity);

            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (cards.length === 0) throw new RegisterRequiredError();

            await this.cardManager.revokeCard(cards[0].id);
            await this.keyLoader.resetLocalPrivateKey();
        } finally {
            this.inProcess = false;
        }
    }

    /**
     * @hidden
     */
    protected async publishCard(
        keyPair: IKeyPair,
        previousCardId?: string,
    ): Promise<{ keyPair: IKeyPair; card: ICard }> {
        const card = await this.cardManager.publishCard({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
            previousCardId,
        });

        return { keyPair, card };
    }

    /**
     * @hidden
     */
    protected isOwnPublicKeysIncluded(ownPublicKey: IPublicKey, publicKeys: IPublicKey[]) {
        const selfPublicKey = this.virgilCrypto.exportPublicKey(ownPublicKey).toString('base64');

        const stringKeys = publicKeys.map(key =>
            this.virgilCrypto.exportPublicKey(key).toString('base64'),
        );
        return stringKeys.some(key => key === selfPublicKey);
    }

    /**
     * @hidden
     */
    protected addOwnPublicKey(
        privateKey: IPrivateKey,
        publicKeys?: EncryptPublicKeyArg,
    ): IPublicKey[] {
        let argument: IPublicKey[];

        if (publicKeys == null) argument = [];
        else if (this.isPublicKey(publicKeys)) argument = [publicKeys];
        else argument = getObjectValues(publicKeys) as IPublicKey[];

        const ownPublicKey = this.virgilCrypto.extractPublicKey(privateKey);

        if (!this.isOwnPublicKeysIncluded(ownPublicKey, argument)) {
            argument.push(ownPublicKey);
        }
        return argument;
    }

    /**
     * @hidden
     */
    protected abstract isPublicKey(publicKey: IPublicKey): boolean;
}
