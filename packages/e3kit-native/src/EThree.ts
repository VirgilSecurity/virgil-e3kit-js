import {
    DEFAULT_API_URL,
    DEFAULT_STORAGE_NAME,
    AbstractEThree,
    PrivateKeyLoader,
} from '@virgilsecurity/e3kit-base';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { virgilCrypto, virgilBrainKeyCrypto } from 'react-native-virgil-crypto';
import { CachingJwtProvider, CardManager, VirgilCardVerifier } from 'virgil-sdk';

import { IPublicKey, EThreeCtorOptions, EThreeInitializeOptions } from './types';
import { withDefaults } from './withDefaults';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     */
    constructor(identity: string, options: EThreeCtorOptions) {
        const opts = withDefaults(options, {
            apiUrl: DEFAULT_API_URL,
            storageName: DEFAULT_STORAGE_NAME,
            useSha256Identifiers: false,
        });
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
        });
        super({
            identity,
            virgilCrypto,
            cardManager,
            accessTokenProvider,
            keyEntryStorage,
            keyLoader,
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
        if (typeof getToken !== 'function') {
            throw new TypeError(
                `EThree.initialize expects a function that returns Virgil JWT, got ${typeof getToken}`,
            );
        }

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
     */
    protected isPublicKey(publicKey: IPublicKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return publicKey != null && typeof (publicKey as any).value === 'string';
    }
}
