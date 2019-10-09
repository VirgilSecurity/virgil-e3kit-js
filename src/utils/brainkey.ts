import { BrainKey, PythiaClient } from 'virgil-pythia';
import { VirgilAgent } from 'virgil-sdk';

import { PRODUCT_NAME, PRODUCT_VERSION } from '../constants';
import { IKeyPair, ICrypto, IBrainKeyCrypto, IAccessTokenProvider } from '../externalTypes';

const BRAIN_KEY_RATE_LIMIT_DELAY = 2000;
const BRAIN_KEY_THROTTLING_ERROR_CODE = 60007;

/**
 * @hidden
 */
export type BrainkeyOptions = {
    virgilCrypto: ICrypto;
    pythiaCrypto: IBrainKeyCrypto;
    accessTokenProvider: IAccessTokenProvider;
    apiUrl?: string;
};

/**
 * @hidden
 */
export async function generateBrainPair(pwd: string, options: BrainkeyOptions): Promise<IKeyPair> {
    const pythiaClient = new PythiaClient(
        options.accessTokenProvider,
        options.apiUrl,
        new VirgilAgent(PRODUCT_NAME, PRODUCT_VERSION),
    );
    const brainKey = new BrainKey({
        pythiaClient,
        crypto: options.virgilCrypto,
        brainKeyCrypto: options.pythiaCrypto,
    });
    return await brainKey.generateKeyPair(pwd).catch((e: Error & { code?: number }) => {
        if (typeof e === 'object' && e.code === BRAIN_KEY_THROTTLING_ERROR_CODE) {
            const promise = new Promise((resolve, reject) => {
                const repeat = () =>
                    brainKey
                        .generateKeyPair(pwd)
                        .then(resolve)
                        .catch(reject);
                setTimeout(repeat, BRAIN_KEY_RATE_LIMIT_DELAY);
            });
            return promise as Promise<IKeyPair>;
        }
        throw e;
    });
}
