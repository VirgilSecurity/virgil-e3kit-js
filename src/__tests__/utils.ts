import {
    VirgilCrypto,
    VirgilAccessTokenSigner,
    VirgilCardCrypto,
    VirgilPythiaCrypto,
} from 'virgil-crypto';
import {
    JwtGenerator,
    KeyEntryStorage,
    CardManager,
    VirgilCardVerifier,
    GeneratorJwtProvider,
    CachingJwtProvider,
} from 'virgil-sdk';
import { createBrainKey } from 'virgil-pythia';
import {
    SyncKeyStorage,
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
} from '@virgilsecurity/keyknox';

export const virgilCrypto = new VirgilCrypto();
const cardCrypto = new VirgilCardCrypto(virgilCrypto);
const cardVerifier = new VirgilCardVerifier(cardCrypto);

export const generator = new JwtGenerator({
    appId: process.env.APP_ID!,
    apiKeyId: process.env.API_KEY_ID!,
    apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
    accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
});

export const mockProvider = new GeneratorJwtProvider(generator);

export const cardManager = new CardManager({
    cardCrypto: cardCrypto,
    cardVerifier: cardVerifier,
    accessTokenProvider: mockProvider,
    retryOnUnauthorized: true,
});

export const keyStorage = new KeyEntryStorage('.virgil-local-storage');
export const keyknoxStorage = new KeyEntryStorage('.virgil-keyknox-storage');

export const createFetchToken = (identity: string) => () =>
    Promise.resolve(generator.generateToken(identity).toString());

export const createSyncStorage = async (identity: string, password: string) => {
    const fetchToken = createFetchToken(identity);
    const brainKey = createBrainKey({
        virgilCrypto: virgilCrypto,
        virgilPythiaCrypto: new VirgilPythiaCrypto(),
        accessTokenProvider: new CachingJwtProvider(fetchToken),
    });

    const keyPair = await brainKey.generateKeyPair(password);

    const storage = new SyncKeyStorage(
        new CloudKeyStorage(
            new KeyknoxManager(
                new CachingJwtProvider(fetchToken),
                keyPair.privateKey,
                keyPair.publicKey,
                undefined,
                new KeyknoxCrypto(virgilCrypto),
            ),
        ),
        keyknoxStorage,
    );

    await storage.sync();
    return storage;
};

export const clear = () =>
    beforeAll(done => Promise.all([keyStorage.clear(), keyknoxStorage.clear()]).then(() => done()));
