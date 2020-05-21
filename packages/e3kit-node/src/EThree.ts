/// <reference path="../declaration.d.ts" />

import {
    DEFAULT_API_URL,
    DEFAULT_STORAGE_NAME,
    DEFAULT_GROUP_STORAGE_NAME,
    AbstractEThree,
    PrivateKeyLoader,
} from '@virgilsecurity/e3kit-base';
import { initPythia, VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import isInvalidPath from 'is-invalid-path';
import leveldown from 'leveldown';
import mkdirp from 'mkdirp';
import {
    initCrypto,
    VirgilCardCrypto,
    VirgilCrypto,
    VirgilPublicKey,
    HashAlgorithm,
} from 'virgil-crypto';
import { CachingJwtProvider, CardManager, KeyEntryStorage, VirgilCardVerifier } from 'virgil-sdk';

import {
    Data,
    FoundationLibraryOptions,
    PythiaLibraryOptions,
    EThreeInitializeOptions,
    EThreeCtorOptions,
} from './types';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    constructor(identity: string, options: EThreeCtorOptions) {
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
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                product: process.env.__VIRGIL_PRODUCT_NAME__!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                version: process.env.__VIRGIL_PRODUCT_VERSION__!,
            },
        });
        if (isInvalidPath(opts.groupStorageName!)) {
            throw new TypeError('`groupStorageName` is not a valid path');
        }
        mkdirp.sync(opts.groupStorageName!);
        const groupStorageLeveldown = leveldown(opts.groupStorageName!);

        super({
            identity,
            virgilCrypto,
            cardManager,
            accessTokenProvider,
            keyEntryStorage,
            keyLoader,
            groupStorageLeveldown,
            keyPairType: options.keyPairType,
        });
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
     * @hidden
     */
    isPublicKey(publicKey: any) {
        return publicKey instanceof VirgilPublicKey;
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
}
