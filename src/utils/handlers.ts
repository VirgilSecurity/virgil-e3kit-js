import { VirgilPrivateKey, VirgilPublicKey } from 'virgil-crypto';

const BRAIN_KEY_RATE_LIMIT_DELAY = 2000;
const BRAIN_KEY_THROTTLING_ERROR_CODE = 60007;

type KeyPair = {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
};

export const createThrottlingHandler = (brainKey: any, pwd: string) => (
    e: Error & { code?: number },
) => {
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
};
