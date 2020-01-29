import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
} from './constants';

export type NodeBuffer = import('@virgilsecurity/e3kit-base').NodeBuffer;
export type Data = import('@virgilsecurity/e3kit-base').Data;
export type ICard = import('@virgilsecurity/e3kit-base').ICard;
export type IPublicKey = import('@virgilsecurity/e3kit-base').IPublicKey;
export type EThreeBaseInitializeOptions = import('@virgilsecurity/e3kit-base').EThreeInitializeOptions;
export type EThreeBaseCtorOptions = import('@virgilsecurity/e3kit-base').EThreeCtorOptions;
export type FindUsersResult = import('@virgilsecurity/e3kit-base').FindUsersResult;
export type LookupResult = import('@virgilsecurity/e3kit-base').LookupResult;

export type KeyPairType = import('virgil-crypto').KeyPairType;
export type VirgilCrypto = import('virgil-crypto').VirgilCrypto;
export type VirgilPrivateKey = import('virgil-crypto').VirgilPrivateKey;

export interface EThreeInitializeOptions extends EThreeBaseInitializeOptions {
    keyPairType?: KeyPairType;
}

export interface EThreeCtorOptions extends EThreeBaseCtorOptions {
    keyPairType?: KeyPairType;
}

/**
 * Callback invoked for each chunk being processed in encryptFile method.
 */
export type onEncryptProgressCallback = (snapshot: onEncryptProgressSnapshot) => void;

/**
 * Callback invoked for each chunk being processed in decryptFile method.
 */
export type onDecryptProgressCallback = (snapshot: onDecryptProgressSnapshot) => void;

// eslint-disable-next-line @typescript-eslint/class-name-casing
interface onProgressSnapshot {
    /**
     * Total size of the file being processed.
     */
    fileSize: number;
    /**
     * Size of the file being encrypted in bytes.
     */
    bytesProcessed: number;
}

/**
 * An argument of the onEncryptProgressCallback.
 */
// eslint-disable-next-line @typescript-eslint/class-name-casing
export interface onEncryptProgressSnapshot extends onProgressSnapshot {
    /**
     * Current status of processing. Can be "Signing" then "Encrypting".
     */
    state: VIRGIL_STREAM_SIGNING_STATE | VIRGIL_STREAM_ENCRYPTING_STATE;
}

// eslint-disable-next-line @typescript-eslint/class-name-casing
export interface onDecryptProgressSnapshot extends onProgressSnapshot {
    /**
     * Current status of processing. Can be "Decrypting" then "Verifying".
     */
    state: VIRGIL_STREAM_DECRYPTING_STATE | VIRGIL_STREAM_VERIFYING_STATE;
}

interface FileOptions {
    /**
     * Size of chunk being processed at one time. Bigger chunks make function execute faster, but
     * consume more memory in one time and can cause a performance hit. Default value is 64kb.
     */
    chunkSize?: number;
    /**
     * Instance of `AbortSignal` which can be received from `AbortController`. Used to cancel encryptFile
     * operation.
     */
    signal?: AbortSignal;
}

/**
 * Options for encryptedFile method.
 */
export interface EncryptFileOptions extends FileOptions {
    /**
     * `onEncryptProgressCallback` parameter.
     */
    onProgress?: onEncryptProgressCallback;
}

/**
 * Options for decryptedFile method.
 */
export interface DecryptFileOptions extends FileOptions {
    /**
     * `onDecryptProgressCallback` parameter.
     */
    onProgress?: onDecryptProgressCallback;
    encryptedOn?: Date;
}
