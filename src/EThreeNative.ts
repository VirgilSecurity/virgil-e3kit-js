import { virgilCrypto, virgilBrainKeyCrypto } from 'react-native-virgil-crypto';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { CachingJwtProvider, CardManager, VirgilCardVerifier } from 'virgil-sdk';
import { AbstractEThree } from './AbstractEThree';
import { IPublicKey, EThreeCtorOptions, EThreeInitializeOptions } from './types';
import { withDefaults } from './utils/object';
import { DEFAULT_API_URL, STORAGE_NAME } from './utils/constants';
import { PrivateKeyLoader } from './PrivateKeyLoader';
import { throwGetTokenNotAFunction } from './errors';

export class EThreeNative extends AbstractEThree {
    constructor(identity: string, options: EThreeCtorOptions) {
        const opts = withDefaults(options, {
            apiUrl: DEFAULT_API_URL,
            storageName: STORAGE_NAME,
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
            cardCrypto,
            cardVerifier,
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
    ): Promise<EThreeNative> {
        if (typeof getToken !== 'function') throwGetTokenNotAFunction(typeof getToken);

        const opts = withDefaults(options as EThreeCtorOptions, {
            accessTokenProvider: new CachingJwtProvider(getToken),
        });
        const token = await opts.accessTokenProvider.getToken({
            service: 'cards',
            operation: '',
        });
        const identity = token.identity();
        return new EThreeNative(identity, opts);
    }

    protected isPublicKey(publicKey: IPublicKey) {
        return publicKey != null && typeof (publicKey as any).value === 'string';
    }
}
