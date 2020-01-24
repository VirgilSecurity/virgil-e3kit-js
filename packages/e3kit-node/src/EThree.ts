/// <reference path="index.d.ts" />

import {
    hasFoundationModules,
    setFoundationModules,
    VirgilCrypto,
    VirgilPublicKey,
} from '@virgilsecurity/base-crypto';
import initFoundation from '@virgilsecurity/core-foundation';
import initPythia from '@virgilsecurity/core-pythia';
import {
    DEFAULT_API_URL,
    DEFAULT_STORAGE_NAME,
    DEFAULT_GROUP_STORAGE_NAME,
    AbstractEThree,
    PrivateKeyLoader,
} from '@virgilsecurity/e3kit-base';
import {
    hasPythiaModules,
    setPythiaModules,
    VirgilBrainKeyCrypto,
} from '@virgilsecurity/pythia-crypto';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { CachingJwtProvider, CardManager, KeyEntryStorage, VirgilCardVerifier } from 'virgil-sdk';
import leveldown from 'leveldown';
import isInvalidPath from 'is-invalid-path';
import mkdirp from 'mkdirp';

import { IPublicKey, EThreeInitializeOptions, EThreeCtorOptions } from './types';

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
                product: process.env.PRODUCT_NAME!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                version: process.env.PRODUCT_VERSION!,
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
        const modulesToLoad: Promise<void>[] = [];
        if (!hasFoundationModules()) {
            modulesToLoad.push(initFoundation().then(setFoundationModules));
        }
        if (!hasPythiaModules()) {
            modulesToLoad.push(initPythia().then(setPythiaModules));
        }
        await Promise.all(modulesToLoad);

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

    /**
     * @hidden
     */
    isPublicKey(publicKey: IPublicKey) {
        return publicKey instanceof VirgilPublicKey;
    }
}
