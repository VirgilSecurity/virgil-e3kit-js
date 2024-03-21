import { initPythia, VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import leveljs from 'level-js';
import {
    initCrypto,
    VirgilCardCrypto,
    VirgilCrypto,
    VirgilPublicKey,
    HashAlgorithm,
    VirgilPrivateKey,
} from 'virgil-crypto';
import { CachingJwtProvider, CardManager, KeyEntryStorage, VirgilCardVerifier } from 'forge-virgil-sdk';

import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
} from './constants';
import { onChunkCallback, processFile } from './processFile';
import { isFile } from './typeguards';
import {
    NodeBuffer,
    Data,
    ICard,
    IPublicKey,
    FoundationLibraryOptions,
    PythiaLibraryOptions,
    EThreeInitializeOptions,
    EThreeCtorOptions,
    EncryptFileOptions,
    DecryptFileOptions,
    LookupResult,
    FindUsersResult,
    AuthDecryptFileOptions,
    AuthEncryptFileOptions,
    EncryptSharedFileResult,
    EncryptSharedFileOptions,
    DecryptSharedFileOptions,
} from './types';
import {
    AbstractEThree,
    DEFAULT_API_URL,
    DEFAULT_GROUP_STORAGE_NAME,
    DEFAULT_STORAGE_NAME,
    IntegrityCheckFailedError,
    PrivateKeyLoader,
    RegisterRequiredError,
} from '@virgilsecurity/e3kit-base';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    constructor(identity: string, options: EThreeCtorOptions) {
        // @ts-ignore
        super(EThree.prepareConstructorParams(identity, options));
    }

    /**
     * Initialize a new instance of EThree which tied to specific user.
     * @param getToken - Function that receive JWT.
     */
    static async initialize(
        getToken: () => Promise<string>,
        options: EThreeInitializeOptions = {},
    ): Promise<EThree> {
        const cryptoOptions = EThree.getFoundationLibraryOptions(options);
        const pythiaOptions = EThree.getPythiaLibraryOptions(options);
        await Promise.all([initCrypto(cryptoOptions), initPythia(pythiaOptions)]);

        if (typeof getToken !== 'function') {
            throw new TypeError(
                `EThree.initialize expects a function that returns Virgil JWT, got ${typeof getToken}`,
            );
        }

        const opts = {
            accessTokenProvider: new CachingJwtProvider(getToken),
            ...options,
        };
        const token = await opts.accessTokenProvider.getToken({
            service: 'cards',
            operation: '',
        });
        const identity = token.identity();
        return new EThree(identity, opts);
    }

    static async derivePasswords(password: Data, options: FoundationLibraryOptions = {}) {
        const cryptoOptions = EThree.getFoundationLibraryOptions(options);
        await initCrypto(cryptoOptions);
        const crypto = new VirgilCrypto();
        const hash1 = crypto.calculateHash(password, HashAlgorithm.SHA256);
        const hash2 = crypto.calculateHash(hash1, HashAlgorithm.SHA512);
        const loginPassword = hash2.slice(0, 32);
        const backupPassword = hash2.slice(32, 64);
        return { loginPassword, backupPassword };
    }

    /**
     * Signs and encrypts File or Blob.
     * If there is no recipient and the message is encrypted for the current user, omit the
     * public key parameter. You can define chunk size and a callback, that will be invoked on each chunk.
     *
     * The file will be read twice during this method execution:
     * 1. To calculate the signature of the plaintext file.
     * 2. To encrypt the file with encoded signature.
     */
    /**
     * @deprecated and will be removed in next major release.
     */
    encryptFile(
        file: File | Blob,
        recipients?: ICard | FindUsersResult,
        options?: EncryptFileOptions,
    ): Promise<File | Blob>;
    encryptFile(
        file: File | Blob,
        recipients?: IPublicKey | LookupResult,
        options?: EncryptFileOptions,
    ): Promise<File | Blob>;
    async encryptFile(
        file: File | Blob,
        recipients?: ICard | FindUsersResult | IPublicKey | LookupResult,
        options: EncryptFileOptions = {},
    ): Promise<File | Blob> {
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');
        const fileSize = file.size;

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeys = this.getPublicKeysForEncryption(privateKey, recipients);
        if (!publicKeys) {
            throw new TypeError(
                'Could not get public keys from the second argument.\n' +
                    'Make sure you pass the resolved value of "EThree.findUsers" or "EThree.lookupPublicKeys" methods ' +
                    'when encrypting for other users, or nothing when encrypting for the current user only.',
            );
        }

        const streamSigner = (this.virgilCrypto as VirgilCrypto).createStreamSigner();

        const signaturePromise = new Promise<NodeBuffer>((resolve, reject) => {
            const onChunk: onChunkCallback = (chunk, offset) => {
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_SIGNING_STATE,
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
                streamSigner.update(this.toData(chunk));
            };

            const onFinishCallback = () =>
                resolve(streamSigner.sign(privateKey as VirgilPrivateKey));

            const onErrorCallback = (err: any) => {
                streamSigner.dispose();
                reject(err);
            };

            processFile({
                file,
                chunkSize,
                onFinishCallback,
                onErrorCallback,
                onChunkCallback: onChunk,
                signal: options.signal,
            });
        });

        const streamCipher = (this.virgilCrypto as VirgilCrypto).createStreamCipher(
            publicKeys as VirgilPublicKey[],
            await signaturePromise,
        );

        const encryptedChunksPromise = new Promise<NodeBuffer[]>((resolve, reject) => {
            const encryptedChunks: NodeBuffer[] = [];
            encryptedChunks.push(streamCipher.start());

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                encryptedChunks.push(streamCipher.update(this.toData(chunk)));
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

            const onErrorCallback = (err: Error) => {
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
     * @deprecated and will be removed in next major release.
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
        senderCardOrPublicKey?: ICard | IPublicKey,
        options: DecryptFileOptions = {},
    ): Promise<File | Blob> {
        const fileSize = file.size;
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');

        const privateKey = (await this.keyLoader.loadLocalPrivateKey()) as VirgilPrivateKey;
        if (!privateKey) throw new RegisterRequiredError();

        const publicKey = this.getPublicKeyForVerification(
            privateKey,
            senderCardOrPublicKey,
            options.encryptedOn,
        );
        if (!publicKey) {
            throw new TypeError(
                'Could not get public key from the second argument.' +
                    'Expected a Virgil Card or a Public Key object. Got ' +
                    typeof senderCardOrPublicKey,
            );
        }

        const streamDecipher = (this.virgilCrypto as VirgilCrypto).createStreamDecipher(privateKey);

        type decryptStreamResult = { signature: NodeBuffer; decryptedChunks: NodeBuffer[] };
        const decryptedChunksPromise = new Promise<decryptStreamResult>((resolve, reject) => {
            const decryptedChunks: NodeBuffer[] = [];

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                decryptedChunks.push(streamDecipher.update(this.toData(chunk)));
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

            const onErrorCallback = (err: Error) => {
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
        const streamVerifier = (this.virgilCrypto as VirgilCrypto).createStreamVerifier(signature);

        let decryptedFile: File | Blob;
        if (isFile(file)) decryptedFile = new File(decryptedChunks, file.name, { type: file.type });
        decryptedFile = new Blob(decryptedChunks, { type: file.type });
        const decryptedFileSize = decryptedFile.size;

        const verifyPromise = new Promise<boolean>((resolve, reject) => {
            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                streamVerifier.update(this.toData(chunk));
                if (options.onProgress) {
                    options.onProgress({
                        state: VIRGIL_STREAM_VERIFYING_STATE,
                        bytesProcessed: offset,
                        fileSize: decryptedFileSize,
                    });
                }
            };

            const onFinishCallback = () =>
                resolve(streamVerifier.verify(publicKey as VirgilPublicKey));

            const onErrorCallback = (err: Error) => {
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
     * Signs and encrypts File or Blob.
     * If there is no recipient and the message is encrypted for the current user, omit the
     * public key parameter. You can define chunk size and a callback, that will be invoked on each chunk.
     */
    authEncryptFile(
        file: File | Blob,
        recipients?: ICard | FindUsersResult,
        options?: EncryptFileOptions,
    ): Promise<File | Blob>;
    authEncryptFile(
        file: File | Blob,
        recipients?: IPublicKey | LookupResult,
        options?: EncryptFileOptions,
    ): Promise<File | Blob>;
    async authEncryptFile(
        file: File | Blob,
        recipients?: ICard | FindUsersResult | IPublicKey | LookupResult,
        options: AuthEncryptFileOptions = {},
    ): Promise<File | Blob> {
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');
        const fileSize = file.size;

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeys = this.getPublicKeysForEncryption(privateKey, recipients);
        if (!publicKeys) {
            throw new TypeError(
                'Could not get public keys from the second argument.\n' +
                    'Make sure you pass the resolved value of "EThree.findUsers" or "EThree.lookupPublicKeys" methods ' +
                    'when encrypting for other users, or nothing when encrypting for the current user only.',
            );
        }

        const streamCipher = (this.virgilCrypto as VirgilCrypto).createStreamSignAndEncrypt(
            privateKey as VirgilPrivateKey,
            publicKeys as VirgilPublicKey[],
            true,
        );

        const encryptedChunksPromise = new Promise<NodeBuffer[]>((resolve, reject) => {
            const encryptedChunks: NodeBuffer[] = [];
            encryptedChunks.push(streamCipher.start(fileSize));

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                encryptedChunks.push(streamCipher.update(this.toData(chunk)));
                if (options.onProgress) {
                    options.onProgress({
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                encryptedChunks.push(streamCipher.final());
                resolve(encryptedChunks);
            };

            const onErrorCallback = (err: Error) => {
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
    async authDecryptFile(
        file: File | Blob,
        senderCardOrPublicKey?: ICard | IPublicKey,
        options: AuthDecryptFileOptions = {},
    ): Promise<File | Blob> {
        const fileSize = file.size;
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');

        const privateKey = (await this.keyLoader.loadLocalPrivateKey()) as VirgilPrivateKey;
        if (!privateKey) throw new RegisterRequiredError();

        const publicKey = this.getPublicKeyForVerification(
            privateKey,
            senderCardOrPublicKey,
            options.encryptedOn,
        );
        if (!publicKey) {
            throw new TypeError(
                'Could not get public key from the second argument.' +
                    'Expected a Virgil Card or a Public Key object. Got ' +
                    typeof senderCardOrPublicKey,
            );
        }

        const streamDecipher = (this.virgilCrypto as VirgilCrypto).createStreamDecryptAndVerify();

        const decryptedChunksPromise = new Promise<NodeBuffer[]>((resolve, reject) => {
            const decryptedChunks: NodeBuffer[] = [];

            streamDecipher.start(privateKey);

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                decryptedChunks.push(streamDecipher.update(this.toData(chunk)));
                if (options.onProgress) {
                    options.onProgress({
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                decryptedChunks.push(streamDecipher.final());
                streamDecipher.verify(publicKey as VirgilPublicKey);
                streamDecipher.dispose();
                resolve(decryptedChunks);
            };

            const onErrorCallback = (err: Error) => {
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

        const decryptedFile = await decryptedChunksPromise;

        if (isFile(file)) return new File(decryptedFile, file.name, { type: file.type });
        return new Blob(decryptedFile, { type: file.type });
    }

    /**
     * Encrypts file with `fileKey` which can be shared among other users.
     * You can define chunk size and a callback, that will be invoked on each chunk.
     */
    encryptSharedFile(
        file: File | Blob,
        options?: EncryptSharedFileOptions,
    ): Promise<EncryptSharedFileResult>;
    async encryptSharedFile(
        file: File | Blob,
        options: EncryptSharedFileOptions = {},
    ): Promise<EncryptSharedFileResult> {
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');
        const fileSize = file.size;

        const privateKey = (await this.keyLoader.loadLocalPrivateKey()) as VirgilPrivateKey;

        const { privateKey: fileKey, publicKey: filePublicKey } = this.virgilCrypto.generateKeys();

        const streamCipher = (this.virgilCrypto as VirgilCrypto).createStreamSignAndEncrypt(
            privateKey as VirgilPrivateKey,
            filePublicKey as VirgilPublicKey,
            true,
        );

        const encryptedChunksPromise = new Promise<NodeBuffer[]>((resolve, reject) => {
            const encryptedChunks: NodeBuffer[] = [];
            encryptedChunks.push(streamCipher.start(fileSize));

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                encryptedChunks.push(streamCipher.update(this.toData(chunk)));
                if (options.onProgress) {
                    options.onProgress({
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                encryptedChunks.push(streamCipher.final());
                resolve(encryptedChunks);
            };

            const onErrorCallback = (err: Error) => {
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
        const encryptedSharedFile = isFile(file)
            ? new File(encryptedChunks, file.name, { type: file.type })
            : new Blob(encryptedChunks, { type: file.type });

        return {
            encryptedSharedFile,
            fileKey: this.virgilCrypto.exportPrivateKey(fileKey),
        };
    }

    /**
     * Decrypts File or Blob with `fileKey` and verifies integrity with `senderCardOrPublicKey`. If there is no recipient
     * and the message is encrypted for the current user, omit the `senderCardOrPublicKey` parameter. You can define
     * chunk size and a callback, that will be invoked on each chunk.
     *
     */
    async decryptSharedFile(
        file: File | Blob,
        fileKey: Data,
        senderCardOrPublicKey?: ICard | IPublicKey,
        options: DecryptSharedFileOptions = {},
    ): Promise<File | Blob> {
        const fileSize = file.size;
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');

        const privateKey = (await this.keyLoader.loadLocalPrivateKey()) as VirgilPrivateKey;
        if (!privateKey) throw new RegisterRequiredError();

        const publicKey = this.getPublicKeyForVerification(
            privateKey,
            senderCardOrPublicKey,
            options.encryptedOn,
        );
        if (!publicKey) {
            throw new TypeError(
                'Could not get public key from the second argument.' +
                    'Expected a Virgil Card or a Public Key object. Got ' +
                    typeof senderCardOrPublicKey,
            );
        }

        const formatedFileKey = this.virgilCrypto.importPrivateKey(fileKey) as VirgilPrivateKey;

        const streamDecipher = (this.virgilCrypto as VirgilCrypto).createStreamDecryptAndVerify();

        const decryptedChunksPromise = new Promise<NodeBuffer[]>((resolve, reject) => {
            const decryptedChunks: NodeBuffer[] = [];

            streamDecipher.start(formatedFileKey);

            const onChunkCallback: onChunkCallback = (chunk, offset) => {
                decryptedChunks.push(streamDecipher.update(this.toData(chunk)));
                if (options.onProgress) {
                    options.onProgress({
                        bytesProcessed: offset,
                        fileSize: fileSize,
                    });
                }
            };

            const onFinishCallback = () => {
                decryptedChunks.push(streamDecipher.final());
                streamDecipher.verify(publicKey as VirgilPublicKey);
                streamDecipher.dispose();
                resolve(decryptedChunks);
            };

            const onErrorCallback = (err: Error) => {
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

        const decryptedFile = await decryptedChunksPromise;

        if (isFile(file)) return new File(decryptedFile, file.name, { type: file.type });
        return new Blob(decryptedFile, { type: file.type });
    }

    /**
     * @hidden
     */
    private static getFoundationLibraryOptions(options: FoundationLibraryOptions) {
        return options.foundationWasmPath
            ? { foundation: [{ locateFile: () => options.foundationWasmPath }] }
            : undefined;
    }

    /**
     * @hidden
     */
    private static getPythiaLibraryOptions(options: PythiaLibraryOptions) {
        return options.pythiaWasmPath
            ? { pythia: [{ locateFile: () => options.pythiaWasmPath }] }
            : undefined;
    }

    /**
     * @hidden
     */
    private static prepareConstructorParams(identity: string, options: EThreeCtorOptions) {
        const opts = {
            apiUrl: DEFAULT_API_URL,
            storageName: DEFAULT_STORAGE_NAME,
            groupStorageName: DEFAULT_GROUP_STORAGE_NAME,
            useSha256Identifiers: false,
            ...options,
        };
        const accessTokenProvider = opts.accessTokenProvider;
        const keyEntryStorage = opts.keyEntryStorage || new KeyEntryStorage(opts.storageName);
        const virgilCrypto = new VirgilCrypto({ useSha256Identifiers: opts.useSha256Identifiers });
        const cardCrypto = new VirgilCardCrypto(virgilCrypto);
        const brainKeyCrypto = new VirgilBrainKeyCrypto();
        const cardVerifier = new VirgilCardVerifier(cardCrypto, {
            verifySelfSignature: opts.apiUrl === DEFAULT_API_URL,
            verifyVirgilSignature: opts.apiUrl === DEFAULT_API_URL,
        });
        const keyLoader = new PrivateKeyLoader(identity, {
            accessTokenProvider,
            virgilCrypto,
            brainKeyCrypto,
            keyEntryStorage,
            apiUrl: opts.apiUrl,
        });
        const cardManager = new CardManager({
            cardCrypto,
            cardVerifier,
            accessTokenProvider,
            retryOnUnauthorized: true,
            apiUrl: opts.apiUrl,
            productInfo: {
                product: process.env.__VIRGIL_PRODUCT_NAME__!,
                version: process.env.__VIRGIL_PRODUCT_VERSION__!,
            },
        });
        const groupStorageLeveldown = leveljs(opts.groupStorageName!);

        return {
            identity,
            virgilCrypto,
            cardManager,
            accessTokenProvider,
            keyEntryStorage,
            keyLoader,
            groupStorageLeveldown,
            keyPairType: options.keyPairType,
        };
    }

    /**
     * @hidden
     */
    protected isPublicKey(publicKey: any) {
        return publicKey instanceof VirgilPublicKey;
    }

    /**
     * @hidden
     */
    private toData = (value: ArrayBuffer | string): Data => {
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }
        return value;
    };
}
