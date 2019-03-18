import { VirgilPrivateKey, VirgilPublicKey, VirgilCrypto } from 'virgil-crypto';
import { createBrainKey } from 'virgil-pythia';
import { VirgilPythiaCrypto } from 'virgil-crypto/dist/types/pythia';
import { IAccessTokenProvider } from 'virgil-sdk';

const BRAIN_KEY_RATE_LIMIT_DELAY = 2000;
const BRAIN_KEY_THROTTLING_ERROR_CODE = 60007;

type KeyPair = {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
};

/**
 * @hidden
 */
export type BrainkeyOptions = {
    virgilCrypto: VirgilCrypto;
    pythiaCrypto: VirgilPythiaCrypto;
    accessTokenProvider: IAccessTokenProvider;
    apiUrl?: string;
};

/**
 * @hidden
 */
export const generateBrainPair = async (pwd: string, options: BrainkeyOptions) => {
    const brainKey = createBrainKey({
        virgilCrypto: options.virgilCrypto,
        virgilPythiaCrypto: options.pythiaCrypto,
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
            return promise as Promise<KeyPair>;
        }
        throw e;
    });
};
