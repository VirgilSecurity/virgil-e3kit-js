import {
    DEFAULT_API_URL,
    DEFAULT_STORAGE_NAME,
    DEFAULT_GROUP_STORAGE_NAME,
    AbstractEThree,
    PrivateKeyLoader,
} from '@virgilsecurity/e3kit-base';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { virgilCrypto, virgilBrainKeyCrypto } from 'react-native-virgil-crypto';
import { CachingJwtProvider, CardManager, VirgilCardVerifier } from 'virgil-sdk';
import asyncstorageDown from 'asyncstorage-down';

import { IPublicKey, EThreeCtorOptions, EThreeInitializeOptions } from './types';

import './asyncstoragedown-clear-polyfill';

export interface EThreeNativeInitializeOptions extends EThreeInitializeOptions {
    AsyncStorage: import('react-native').AsyncStorageStatic;
}

export interface EThreeNativeCtorOptions extends EThreeCtorOptions {
    AsyncStorage: import('react-native').AsyncStorageStatic;
}

export class EThree extends AbstractEThree {
    /**
     * @hidden
     */
    constructor(identity: string, options: EThreeNativeCtorOptions) {
        const opts = {
            apiUrl: DEFAULT_API_URL,
            storageName: DEFAULT_STORAGE_NAME,
            groupStorageName: DEFAULT_GROUP_STORAGE_NAME,
            useSha256Identifiers: false,
            ...options,
        };
        const accessTokenProvider = opts.accessTokenProvider;
        const keyEntryStorage =
            opts.keyEntryStorage || createNativeKeyEntryStorage({ username: opts.storageName });
        const cardCrypto = new VirgilCardCrypto(virgilCrypto);
        const cardVerifier = new VirgilCardVerifier(cardCrypto);
        const keyLoader = new PrivateKeyLoader(identity, {
            accessTokenProvider,
            virgilCrypto,
            brainKeyCrypto: virgilBrainKeyCrypto,
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
        const groupStorageLeveldown = asyncstorageDown(opts.groupStorageName!, {
            AsyncStorage: opts.AsyncStorage,
        });

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
        options: EThreeNativeInitializeOptions,
    ): Promise<EThree> {
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
    protected isPublicKey(publicKey: IPublicKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return publicKey != null && typeof (publicKey as any).value === 'string';
    }
}
