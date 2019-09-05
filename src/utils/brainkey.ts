import { createBrainKey } from 'virgil-pythia';

import { IKeyPair, ICrypto, IBrainKeyCrypto, IAccessTokenProvider } from '../types';

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
export const generateBrainPair = async (pwd: string, options: BrainkeyOptions) => {
    const brainKey = createBrainKey({
        virgilCrypto: options.virgilCrypto,
        virgilBrainKeyCrypto: options.pythiaCrypto,
        accessTokenProvider: options.accessTokenProvider,
        apiUrl: options.apiUrl,
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
};
