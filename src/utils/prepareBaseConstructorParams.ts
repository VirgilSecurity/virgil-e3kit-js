import { VirgilCrypto } from '@virgilsecurity/base-crypto';
import { VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import { VirgilCardCrypto } from '@virgilsecurity/sdk-crypto';
import { CardManager, KeyEntryStorage, VirgilCardVerifier } from 'virgil-sdk';

import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { EThreeCtorOptions } from '../types';
import { DEFAULT_API_URL, STORAGE_NAME } from './constants';
import { withDefaults } from './object';

/**
 * @hidden
 */
export function prepareBaseConstructorParams(identity: string, options: EThreeCtorOptions) {
    const opts = withDefaults(options, {
        apiUrl: DEFAULT_API_URL,
        storageName: STORAGE_NAME,
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
        productInfo: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            product: process.env.PRODUCT_NAME!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            version: process.env.PRODUCT_VERSION!,
        },
    });

    return {
        identity,
        virgilCrypto,
        cardCrypto,
        cardVerifier,
        cardManager,
        accessTokenProvider,
        keyEntryStorage,
        keyLoader,
    };
}
