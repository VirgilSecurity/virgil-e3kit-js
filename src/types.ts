export type VirgilPrivateKey = import('@virgilsecurity/base-crypto').VirgilPrivateKey;

export type NodeBuffer = import('@virgilsecurity/crypto-types').NodeBuffer;
export type Data = import('@virgilsecurity/crypto-types').Data;
export type IKeyPair = import('@virgilsecurity/crypto-types').IKeyPair;
export type IPrivateKey = import('@virgilsecurity/crypto-types').IPrivateKey;
export type IPublicKey = import('@virgilsecurity/crypto-types').IPublicKey;
export type ICrypto = import('@virgilsecurity/crypto-types').ICrypto;
export type ICardCrypto = import('@virgilsecurity/crypto-types').ICardCrypto;
export type IBrainKeyCrypto = import('@virgilsecurity/crypto-types').IBrainKeyCrypto;

export type IAccessTokenProvider = import('virgil-sdk').IAccessTokenProvider;
export type IKeyEntryStorage = import('virgil-sdk').IKeyEntryStorage;

import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
} from './utils/constants';
import { IKeyEntryStorage } from 'virgil-sdk';

export interface EThreeInitializeOptions {
    /**
     * Implementation of IKeyEntryStorage. Used IndexedDB Key Storage from
     * [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript) by default.
     */
    keyEntryStorage?: IKeyEntryStorage;
    /**
     * Url of the Card Services. Used for development purposes.
     */
    apiUrl?: string;
    /**
     * Indicates whether to use old algorithm to calculate keypair identifiers.
     */
    useSha256Identifiers?: boolean;
    /**
     * Name of the IndexedDB database. Default `.virgil-local-storage`.
     */
    storageName?: string;
}

/**
 * @hidden
 */
export interface EThreeCtorOptions extends EThreeInitializeOptions {
    /**
     * Implementation of IAccessTokenProvider from [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript);
     */
    accessTokenProvider: IAccessTokenProvider;
}

/**
 * Dictionary returned from lookupPublicKey method
 */
export type LookupResult = {
    [identity: string]: IPublicKey;
};

/**
 * Argument for encrypt function can be single IPublicKey or LookupResult
 */
export type EncryptPublicKeyArg = LookupResult | IPublicKey;

/**
 * Callback invoked for each chunk being processed in encryptFile method.
 */
export type onEncryptProgressCallback = (snapshot: onEncryptProgressSnapshot) => void;

/**
 * Callback invoked for each chunk being processed in decryptFile method.
 */
export type onDecryptProgressCallback = (snapshot: onDecryptProgressSnapshot) => void;

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
export interface onEncryptProgressSnapshot extends onProgressSnapshot {
    /**
     * Current status of processing. Can be "Signing" then "Encrypting".
     */
    state: VIRGIL_STREAM_SIGNING_STATE | VIRGIL_STREAM_ENCRYPTING_STATE;
}

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
}
