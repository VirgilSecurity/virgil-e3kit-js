import initFoundation from '@virgilsecurity/core-foundation';
import {
    setFoundationModules,
    hasFoundationModules,
    VirgilPublicKey,
} from '@virgilsecurity/base-crypto';
import {
    AbstractEThree,
    IntegrityCheckFailedError,
    RegisterRequiredError,
} from '@virgilsecurity/e3kit-base';
import { initPythia, hasPythiaModules } from '@virgilsecurity/pythia-crypto';
import { CachingJwtProvider } from 'virgil-sdk';

import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
} from './utils/constants';
import { withDefaults } from './utils/object';
import { prepareBaseConstructorParams } from './utils/prepareBaseConstructorParams';
import { onChunkCallback, processFile } from './utils/processFile';
import { isFile } from './utils/typeguards';
import { throwGetTokenNotAFunction } from './utils/error';
import {
    NodeBuffer,
    Data,
    IPublicKey,
    VirgilCrypto,
    VirgilPrivateKey,
    EThreeInitializeOptions,
    EThreeCtorOptions,
    EncryptPublicKeyArg,
    EncryptFileOptions,
    DecryptFileOptions,
} from './types';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    // @ts-ignore
    constructor(identity: string, options: EThreeCtorOptions) {
        super(prepareBaseConstructorParams(identity, options));
    }

    /**
     * Initialize a new instance of EThree which tied to specific user.
     * @param getToken - Function that receive JWT.
     */
    static async initialize(
        getToken: () => Promise<string>,
        options: EThreeInitializeOptions = {},
    ): Promise<EThree> {
        const modulesToLoad: Promise<void>[] = [];
        if (!hasFoundationModules()) {
            modulesToLoad.push(initFoundation().then(setFoundationModules));
        }
        if (!hasPythiaModules()) {
            modulesToLoad.push(initPythia());
        }
        await Promise.all(modulesToLoad);

        if (typeof getToken !== 'function') throwGetTokenNotAFunction(typeof getToken);

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
        publicKeys?: EncryptPublicKeyArg,
        options: EncryptFileOptions = {},
    ): Promise<File | Blob> {
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');
        const fileSize = file.size;

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        const publicKeysArray = this.addOwnPublicKey(privateKey, publicKeys) as VirgilPublicKey[];

        const streamSigner = (this.virgilCrypto as VirgilCrypto).createStreamSigner();

        const signaturePromise = new Promise<NodeBuffer>((resolve, reject) => {
            const onChunkCallback: onChunkCallback = (chunk, offset) => {
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
                onChunkCallback,
                onFinishCallback,
                onErrorCallback,
                signal: options.signal,
            });
        });

        const streamCipher = (this.virgilCrypto as VirgilCrypto).createStreamCipher(
            publicKeysArray,
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
        publicKey?: IPublicKey,
        options: DecryptFileOptions = {},
    ): Promise<File | Blob> {
        const fileSize = file.size;
        const chunkSize = options.chunkSize ? options.chunkSize : 64 * 1024;
        if (!Number.isInteger(chunkSize)) throw TypeError('chunkSize should be an integer value');

        const privateKey = (await this.keyLoader.loadLocalPrivateKey()) as VirgilPrivateKey;
        if (!privateKey) throw new RegisterRequiredError();
        if (!publicKey)
            publicKey = this.virgilCrypto.extractPublicKey(privateKey) as VirgilPublicKey;

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
                resolve(streamVerifier.verify(publicKey! as VirgilPublicKey));
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
     * @hidden
     */
    protected isPublicKey(publicKey: IPublicKey) {
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
