import {
    hasFoundationModules,
    setFoundationModules,
    VirgilCrypto,
    VirgilPublicKey,
} from '@virgilsecurity/base-crypto';
import initFoundation from '@virgilsecurity/core-foundation';
import {
    DEFAULT_API_URL,
    DEFAULT_STORAGE_NAME,
    AbstractEThree,
    PrivateKeyLoader,
} from '@virgilsecurity/e3kit-base';
import { initPythia, hasPythiaModules, VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { CachingJwtProvider, CardManager, KeyEntryStorage, VirgilCardVerifier } from 'virgil-sdk';

import { IPublicKey, EThreeInitializeOptions, EThreeCtorOptions } from './types';
import { withDefaults } from './withDefaults';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    constructor(identity: string, options: EThreeCtorOptions) {
        const opts = withDefaults(options, {
            apiUrl: DEFAULT_API_URL,
            storageName: DEFAULT_STORAGE_NAME,
            useSha256Identifiers: false,
        });
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
        const modulesToLoad: Promise<void>[] = [];
        if (!hasFoundationModules()) {
            modulesToLoad.push(initFoundation().then(setFoundationModules));
        }
        if (!hasPythiaModules()) {
            modulesToLoad.push(initPythia());
        }
        await Promise.all(modulesToLoad);

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
    isPublicKey(publicKey: IPublicKey) {
        return publicKey instanceof VirgilPublicKey;
    }
}
