import PrivateKeyLoader from './PrivateKeyLoader';
import {
    CachingJwtProvider,
    KeyEntryAlreadyExistsError,
    CardManager,
    VirgilCardVerifier,
    IKeyEntryStorage,
    IAccessTokenProvider,
    KeyEntryStorage,
} from 'virgil-sdk';
import {
    VirgilPublicKey,
    Data,
    VirgilCrypto,
    VirgilCardCrypto,
    VirgilPrivateKey,
} from 'virgil-crypto/dist/virgil-crypto-pythia.es';
import {
    RegisterRequiredError,
    EmptyArrayError,
    IdentityAlreadyExistsError,
    PrivateKeyAlreadyExistsError,
    MultipleCardsError,
    LookupNotFoundError,
    LookupError,
    DUPLICATE_IDENTITIES,
} from './errors';
import { isArray, isString } from './utils/typeguards';
import { hasDuplicates, getObjectValues } from './utils/array';
import { withDefaults } from './utils/object';

export interface IEThreeInitOptions {
    /**
     * Implementation of IKeyEntryStorage. If not specified using IndexedDB Key Storage from [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript);
     */
    keyEntryStorage?: IKeyEntryStorage;
    /**
     * Url of the Card Services. Used for development purposes.
     */
    apiUrl?: string;
}

export interface IEThreeCtorOptions extends IEThreeInitOptions {
    /**
     * Implementation of IAccessTokenProvider from [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript);
     */
    accessTokenProvider: IAccessTokenProvider;
}

type KeyPair = {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
};

export type LookupResult = {
    [identity: string]: VirgilPublicKey;
};

const throwIllegalInvocationError = (method: string) => {
    throw new Error(`Calling ${method} two or more times in a row is not allowed.`);
};

type EncryptVirgilPublicKeyArg = LookupResult | VirgilPublicKey;

const _inProcess = Symbol('inProcess');
const _keyLoader = Symbol('keyLoader');
const STORAGE_NAME = '.virgil-local-storage';
const DEFAULT_API_URL = 'https://api.virgilsecurity.com';

export default class EThree {
    /**
     * Unique identifier of current user. Received from JWT token.
     */
    identity: string;
    /**
     * Instance of [VirgilCrypto](https://github.com/virgilsecurity/virgil-crypto-javascript)
     */
    virgilCrypto = new VirgilCrypto();
    /**
     * Instance of VirgilCardCrypto
     */
    cardCrypto = new VirgilCardCrypto(this.virgilCrypto);
    /**
     * Instance of VirgilCardVerifier;
     */
    cardVerifier: VirgilCardVerifier;
    /**
     * Instance of CardManager;
     */
    cardManager: CardManager;
    /**
     * Instance of IAccessTokenProvider implementation. Using [[getToken]] to receive JWT;
     */
    accessTokenProvider: IAccessTokenProvider;
    /**
     * Instance of IKeyEntryStorage implementation. Used for storing private keys;
     */
    keyEntryStorage: IKeyEntryStorage;

    private [_keyLoader]: PrivateKeyLoader;
    private [_inProcess]: boolean = false;

    /**
     * Initialize a new instance of EThree which tied to specific user.
     * @param getToken - Function that receive JWT.
     */
    static async initialize(
        getToken: () => Promise<string>,
        options: IEThreeInitOptions = {},
    ): Promise<EThree> {
        const opts = withDefaults(options as IEThreeCtorOptions, {
            accessTokenProvider: new CachingJwtProvider(getToken),
        });
        const token = await opts.accessTokenProvider.getToken({ operation: 'get' });
        const identity = token.identity();
        return new EThree(identity, opts);
    }

    /**
     * @param identity - Identity of the current user.
     */
    constructor(identity: string, options: IEThreeCtorOptions) {
        const opts = withDefaults(options, { apiUrl: DEFAULT_API_URL });
        this.identity = identity;
        this.accessTokenProvider = opts.accessTokenProvider;
        this.keyEntryStorage = opts.keyEntryStorage || new KeyEntryStorage(STORAGE_NAME);
        this.cardVerifier = new VirgilCardVerifier(this.cardCrypto, {
            verifySelfSignature: opts.apiUrl === DEFAULT_API_URL,
            verifyVirgilSignature: opts.apiUrl === DEFAULT_API_URL,
        });

        this[_keyLoader] = new PrivateKeyLoader(this.identity, {
            accessTokenProvider: this.accessTokenProvider,
            virgilCrypto: this.virgilCrypto,
            keyEntryStorage: this.keyEntryStorage,
            apiUrl: opts.apiUrl,
        });

        this.cardManager = new CardManager({
            cardCrypto: this.cardCrypto,
            cardVerifier: this.cardVerifier,
            accessTokenProvider: this.accessTokenProvider,
            retryOnUnauthorized: true,
            apiUrl: opts.apiUrl,
        });
    }

    /**
     * Register current user in Virgil Cloud. Saves private key locally and uploads public key to cloud.
     */
    async register() {
        if (this[_inProcess]) throwIllegalInvocationError('register');
        this[_inProcess] = true;
        try {
            const [cards, privateKey] = await Promise.all([
                this.cardManager.searchCards(this.identity),
                this[_keyLoader].loadLocalPrivateKey(),
            ]);
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (cards.length > 0) throw new IdentityAlreadyExistsError();
            if (privateKey && cards.length === 0) await this[_keyLoader].resetLocalPrivateKey();
            const keyPair = this.virgilCrypto.generateKeys();
            await this._publishCard(keyPair);
            await this[_keyLoader].savePrivateKeyLocal(keyPair.privateKey);
        } finally {
            this[_inProcess] = false;
        }
        return;
    }

    /**
     * Generates a new private key and saves locally. Replaces old public key with new one in Cloud.
     * Used in case if old private key is lost.
     */
    async rotatePrivateKey(): Promise<void> {
        if (this[_inProcess]) throwIllegalInvocationError('rotatePrivateKey');
        this[_inProcess] = true;
        try {
            const [cards, privateKey] = await Promise.all([
                this.cardManager.searchCards(this.identity),
                this[_keyLoader].loadLocalPrivateKey(),
            ]);
            if (cards.length === 0) throw new RegisterRequiredError();
            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (privateKey) throw new PrivateKeyAlreadyExistsError();
            const keyPair = this.virgilCrypto.generateKeys();
            await this._publishCard(keyPair, cards[0].id);
            await this[_keyLoader].savePrivateKeyLocal(keyPair.privateKey);
        } finally {
            this[_inProcess] = false;
        }
    }

    /**
     * Downloads private key from Virgil Cloud. Use [[backupPrivateKey]] to upload at first.
     * @param pwd User password for access to Virgil Keyknox Storage.
     */
    async restorePrivateKey(pwd: string): Promise<void> {
        try {
            await this[_keyLoader].restorePrivateKey(pwd);
        } catch (e) {
            if (e instanceof KeyEntryAlreadyExistsError) {
                throw new PrivateKeyAlreadyExistsError();
            }
            throw e;
        }
    }

    /**
     * Deletes local private key from key storage. Make sure you made [[backupPrivateKey]] key first.
     */
    async cleanup() {
        await this[_keyLoader].resetLocalPrivateKey();
    }

    /**
     * Delete private key saved in Virgil Keyknox Storage.
     * @param pwd User password for access to Virgil Keyknox Storage. If password omitted resets all
     * Keyknox storage.
     */
    async resetPrivateKeyBackup(pwd?: string) {
        if (!pwd) return await this[_keyLoader].resetAll();
        return this[_keyLoader].resetPrivateKeyBackup(pwd);
    }

    /**
     * Encrypts data.
     * @param message - Plain data you want to encrypt.
     * @param publicKey - Public keys of recipients. If omitted encrypts only for yourself.
     */
    async encrypt(
        message: ArrayBuffer,
        publicKey?: EncryptVirgilPublicKeyArg,
    ): Promise<ArrayBuffer>;
    async encrypt(message: string, publicKeys?: EncryptVirgilPublicKeyArg): Promise<string>;
    async encrypt(message: Buffer, publicKey?: EncryptVirgilPublicKeyArg): Promise<Buffer>;
    async encrypt(message: Data, publicKeys?: EncryptVirgilPublicKeyArg): Promise<Data> {
        const isMessageString = isString(message);
        let argument: VirgilPublicKey[];

        if (publicKeys == null) argument = [];
        else if (publicKeys instanceof VirgilPublicKey) argument = [publicKeys];
        else argument = getObjectValues(publicKeys) as VirgilPublicKey[];

        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const ownPublicKey = this.virgilCrypto.extractPublicKey(privateKey);

        if (!this._isOwnPublicKeysIncluded(ownPublicKey, argument)) {
            argument.push(ownPublicKey);
        }

        const res: Data = this.virgilCrypto.signThenEncrypt(message, privateKey, argument);
        if (isMessageString) return res.toString('base64');
        return res;
    }

    /**
     * Decrypts data.
     * @param message - Encrypted data you want to decrypt.
     * @param publicKey - Public key of sender. If sender is you - omit that parameter.
     */
    async decrypt(message: string, publicKey?: VirgilPublicKey): Promise<string>;
    async decrypt(message: Buffer, publicKey?: VirgilPublicKey): Promise<Buffer>;
    async decrypt(message: ArrayBuffer, publicKey?: VirgilPublicKey): Promise<Buffer>;
    async decrypt(message: Data, publicKey?: VirgilPublicKey): Promise<Data> {
        const isMessageString = isString(message);

        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        if (!publicKey) publicKey = this.virgilCrypto.extractPublicKey(privateKey);

        const res: Data = this.virgilCrypto.decryptThenVerify(message, privateKey, publicKey);
        if (isMessageString) return res.toString('utf8') as string;
        return res as Buffer;
    }

    /**
     * Find public keys for user identities which registered on Virgil Cloud.
     * @param identities;
     */
    async lookupPublicKeys(identities: string): Promise<VirgilPublicKey>;
    async lookupPublicKeys(identities: string[]): Promise<LookupResult>;
    async lookupPublicKeys(identities: string[] | string): Promise<LookupResult | VirgilPublicKey> {
        const argument = isArray(identities) ? identities : [identities];
        if (argument.length === 0) throw new EmptyArrayError('lookupPublicKeys');
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
                result[identity] = filteredCards[0].publicKey as VirgilPublicKey;
            }
        }

        if (getObjectValues(resultWithErrors).length !== 0) {
            throw new LookupError({ ...resultWithErrors, ...result });
        }

        if (Array.isArray(identities)) return result;

        return result[identities];
    }

    /**
     * Changes password for access to your private key backup.
     */
    async changePassword(oldPwd: string, newPwd: string) {
        return await this[_keyLoader].changePassword(oldPwd, newPwd);
    }

    /**
     * Uploads your private key to Virgil Keyknox Storage.
     */
    async backupPrivateKey(pwd: string): Promise<void> {
        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        await this[_keyLoader].savePrivateKeyRemote(privateKey, pwd);
        return;
    }

    /**
     * Checks if you have private key saved locally.
     */
    hasLocalPrivateKey(): Promise<Boolean> {
        return this[_keyLoader].hasPrivateKey();
    }

    private async _publishCard(keyPair: KeyPair, previousCardId?: string) {
        const card = await this.cardManager.publishCard({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
            previousCardId,
        });

        return { keyPair, card };
    }

    private _isOwnPublicKeysIncluded(ownPublicKey: VirgilPublicKey, publicKeys: VirgilPublicKey[]) {
        const selfPublicKey = this.virgilCrypto.exportPublicKey(ownPublicKey).toString('base64');

        const stringKeys = publicKeys.map(key =>
            this.virgilCrypto.exportPublicKey(key).toString('base64'),
        );
        return stringKeys.some((key, i) => key === selfPublicKey);
    }
}
