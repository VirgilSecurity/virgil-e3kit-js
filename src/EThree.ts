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
    IdentityAlreadyExistsError,
    PrivateKeyAlreadyExistsError,
    MultipleCardsError,
    LookupNotFoundError,
    LookupError,
    DUPLICATE_IDENTITIES,
    EMPTY_ARRAY,
    throwIllegalInvocationError,
    IntegrityCheckFailedError,
} from './errors';
import { isArray, isString, isFile, isVirgilPublicKey } from './utils/typeguards';
import { withDefaults } from './utils/object';
import { getObjectValues, hasDuplicates } from './utils/array';
import { processFile, onChunkCallback } from './utils/processFile';
import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
    DEFAULT_API_URL,
    STORAGE_NAME,
} from './utils/constants';
import {
    EncryptVirgilPublicKeyArg,
    LookupResult,
    EThreeInitializeOptions,
    EncryptFileOptions,
    DecryptFileOptions,
} from './types';
import { KeyPair, EThreeCtorOptions } from './utils/innerTypes';

const _inProcess = Symbol('inProcess');
const _keyLoader = Symbol('keyLoader');

export default class EThree {
    /**
     * Unique identifier of current user. Received from JWT token.
     */
    identity: string;
    /**
     * Instance of [VirgilCrypto](https://github.com/virgilsecurity/virgil-crypto-javascript).
     */
    virgilCrypto: VirgilCrypto;
    /**
     * Instance of VirgilCardCrypto.
     */
    cardCrypto: VirgilCardCrypto;
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

    private [_keyLoader]: PrivateKeyLoader;
    private [_inProcess]: boolean = false;

    /**
     * Initialize a new instance of EThree which tied to specific user.
     * @param getToken - Function that receive JWT.
     */
    static async initialize(
        getToken: () => Promise<string>,
        options: EThreeInitializeOptions = {},
    ): Promise<EThree> {
        const opts = withDefaults(options as EThreeCtorOptions, {
            accessTokenProvider: new CachingJwtProvider(getToken),
        });
        const token = await opts.accessTokenProvider.getToken({
            service: 'cards',
            operation: '',
        });
        const identity = token.identity();
        return new EThree(identity, opts);
    }

    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    constructor(identity: string, options: EThreeCtorOptions) {
        const opts = withDefaults(options, {
            apiUrl: DEFAULT_API_URL,
            storageName: STORAGE_NAME,
            useSha256Identifiers: false,
        });

        this.identity = identity;
        this.accessTokenProvider = opts.accessTokenProvider;

        this.keyEntryStorage = opts.keyEntryStorage || new KeyEntryStorage(opts.storageName);
        this.virgilCrypto = new VirgilCrypto({ useSha256Identifiers: opts.useSha256Identifiers });
        this.cardCrypto = new VirgilCardCrypto(this.virgilCrypto);

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
     * Downloads private key from Virgil Cloud. Use [[backupPrivateKey]] to upload the key first.
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
     * Deletes local private key from key storage. Make sure [[backupPrivateKey]] method was called
     * first.
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
     * Encrypts and signs data for recipient public key or `LookupResult` dictionary for multiple recipients.
     * If there is no recipient and message encrypted for the current user, omit public key.
     */
    async encrypt(
        message: ArrayBuffer,
        publicKey?: EncryptVirgilPublicKeyArg,
    ): Promise<ArrayBuffer>;
    async encrypt(message: string, publicKeys?: EncryptVirgilPublicKeyArg): Promise<string>;
    async encrypt(message: Buffer, publicKey?: EncryptVirgilPublicKeyArg): Promise<Buffer>;
    async encrypt(message: Data, publicKeys?: EncryptVirgilPublicKeyArg): Promise<Data> {
        const isMessageString = isString(message);

        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeysArray = this._addOwnPublicKey(privateKey, publicKeys);

        const res: Data = this.virgilCrypto.signThenEncrypt(message, privateKey, publicKeysArray);
        if (isMessageString) return res.toString('base64');
        return res;
    }

    /**
     * Decrypts data and verify signature of sender by his public key. If message is self-encrypted,
     * omit public key parameter.
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
     * Signs and encrypts File or Blob for recipient public key or `LookupResult` dictionary for multiple
     * recipients. If there is no recipient and the message is encrypted for the current user, omit the
     * public key parameter. You can define chunk size and a callback, that will be invoked on each chunk.
     *
     * The file will be read twice during this method execution:
     * 1. To calculate the signature of the plaintext file.
     * 2. To encrypt the file with encoded signature.
     */
    async encryptFile(
        file: File | Blob,
        publicKeys?: EncryptVirgilPublicKeyArg,
        options: EncryptFileOptions = {},
    ): Promise<File | Blob> {
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');
        const fileSize = file.size;

        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeysArray = this._addOwnPublicKey(privateKey, publicKeys);

        const streamSigner = this.virgilCrypto.createStreamSigner();

        const signaturePromise = new Promise<Buffer>((resolve, reject) => {
            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_SIGNING_STATE,
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
                streamSigner.update(chunk);
            };

            const onFinishCallback = () => resolve(streamSigner.sign(privateKey));

            const onErrorCallback = (err: any) => {
                streamSigner.dispose();
                reject(err);
            };

            processFile({
                file,
                chunkSize,
                onChunkCallback,
                onFinishCallback,
                onErrorCallback,
                signal: options.signal,
            });
        });

        const streamCipher = this.virgilCrypto.createStreamCipher(publicKeysArray, {
            signature: await signaturePromise,
        });

        const encryptedChunksPromise = new Promise<Buffer[]>((resolve, reject) => {
            const encryptedChunks: Buffer[] = [];
            encryptedChunks.push(streamCipher.start());

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                encryptedChunks.push(streamCipher.update(chunk));
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_ENCRYPTING_STATE,
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                encryptedChunks.push(streamCipher.final());
                resolve(encryptedChunks);
            };

            const onErrorCallback = (err: any) => {
                reject(err);
                streamCipher.dispose();
            };

            processFile({
                file,
                chunkSize,
                onChunkCallback,
                onFinishCallback,
                onErrorCallback,
                signal: options.signal,
            });
        });

        const encryptedChunks = await encryptedChunksPromise;
        if (isFile(file)) return new File(encryptedChunks, file.name, { type: file.type });
        return new Blob(encryptedChunks, { type: file.type });
    }
    /**
     * Decrypts and verifies integrity of File or Blob for recipient public key. If there is no recipient
     * and the message is encrypted for the current user, omit the public key parameter. You can define
     * chunk size and a callback, that will be invoked on each chunk.
     *
     * The file will be read twice during this method execution:
     * 1. To decrypt encrypted file.
     * 2. To verify the validity of the signature over the decrypted file for the public key.
     */
    async decryptFile(
        file: File | Blob,
        publicKey?: VirgilPublicKey,
        options: DecryptFileOptions = {},
    ): Promise<File | Blob> {
        const fileSize = file.size;
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');

        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        if (!publicKey) publicKey = this.virgilCrypto.extractPublicKey(privateKey);

        const streamDecipher = this.virgilCrypto.createStreamDecipher(privateKey);

        type decryptStreamResult = { signature: Buffer; decryptedChunks: Buffer[] };
        const decryptedChunksPromise = new Promise<decryptStreamResult>((resolve, reject) => {
            const decryptedChunks: Buffer[] = [];

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                decryptedChunks.push(streamDecipher.update(chunk));
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_DECRYPTING_STATE,
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                decryptedChunks.push(streamDecipher.final(false));
                const signature = streamDecipher.getSignature();
                streamDecipher.dispose();
                if (!signature) throw new IntegrityCheckFailedError('Signature not present.');
                resolve({ decryptedChunks, signature });
            };

            const onErrorCallback = (err: any) => {
                streamDecipher.dispose();
                reject(err);
            };

            processFile({
                file,
                chunkSize,
                onChunkCallback,
                onFinishCallback,
                onErrorCallback,
                signal: options.signal,
            });
        });

        const { decryptedChunks, signature } = await decryptedChunksPromise;
        const streamVerifier = this.virgilCrypto.createStreamVerifier(signature, 'utf8');

        let decryptedFile: File | Blob;
        if (isFile(file)) decryptedFile = new File(decryptedChunks, file.name, { type: file.type });
        decryptedFile = new Blob(decryptedChunks, { type: file.type });
        const decryptedFileSize = decryptedFile.size;

        const verifyPromise = new Promise<boolean>((resolve, reject) => {
            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                streamVerifier.update(chunk);
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_VERIFYING_STATE,
                        bytesProcessed: offset,
                        fileSize: decryptedFileSize,
                    });
                }
            };

            const onFinishCallback = () => resolve(streamVerifier.verify(publicKey!));
            const onErrorCallback = (err: any) => {
                streamVerifier.dispose();
                reject(err);
            };

            processFile({
                file: decryptedFile,
                chunkSize,
                onChunkCallback,
                onFinishCallback,
                onErrorCallback,
                signal: options.signal,
            });
        });

        const isVerified = await verifyPromise;

        if (!isVerified) {
            throw new IntegrityCheckFailedError('Signature verification has failed.');
        }

        return decryptedFile;
    }

    /**
     * Find public keys for user identities registered on Virgil Cloud.
     */
    async lookupPublicKeys(identity: string): Promise<VirgilPublicKey>;
    async lookupPublicKeys(identities: string[]): Promise<LookupResult>;
    async lookupPublicKeys(identities: string[] | string): Promise<LookupResult | VirgilPublicKey> {
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
     * Changes password for access to current user private key backup.
     * @param oldPwd users old password
     * @param newPwd users new password
     */
    async changePassword(oldPwd: string, newPwd: string) {
        return await this[_keyLoader].changePassword(oldPwd, newPwd);
    }

    /**
     * Uploads current user private key to Virgil Keyknox Storage.
     */
    async backupPrivateKey(pwd: string): Promise<void> {
        const privateKey = await this[_keyLoader].loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        await this[_keyLoader].savePrivateKeyRemote(privateKey, pwd);
        return;
    }

    /**
     * Checks if current user has private key saved locally.
     */
    hasLocalPrivateKey(): Promise<Boolean> {
        return this[_keyLoader].hasPrivateKey();
    }

    /**
     * Unregister current user. Revokes public key in Virgil Cloud and deletes local private key.
     */
    async unregister(): Promise<void> {
        if (this[_inProcess]) throwIllegalInvocationError('unregister');
        this[_inProcess] = true;
        try {
            const cards = await this.cardManager.searchCards(this.identity);

            if (cards.length > 1) throw new MultipleCardsError(this.identity);
            if (cards.length === 0) throw new RegisterRequiredError();

            await this.cardManager.revokeCard(cards[0].id);
            await this[_keyLoader].resetLocalPrivateKey();
        } finally {
            this[_inProcess] = false;
        }
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

    private _addOwnPublicKey(privateKey: VirgilPrivateKey, publicKeys?: EncryptVirgilPublicKeyArg) {
        let argument: VirgilPublicKey[];

        if (publicKeys == null) argument = [];
        else if (isVirgilPublicKey(publicKeys)) argument = [publicKeys];
        else argument = getObjectValues(publicKeys) as VirgilPublicKey[];

        const ownPublicKey = this.virgilCrypto.extractPublicKey(privateKey);

        if (!this._isOwnPublicKeysIncluded(ownPublicKey, argument)) {
            argument.push(ownPublicKey);
        }
        return argument;
    }
}
