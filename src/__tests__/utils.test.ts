import {
    VirgilCrypto,
    VirgilAccessTokenSigner,
    VirgilCardCrypto,
    VirgilPythiaCrypto,
} from 'virgil-crypto/dist/virgil-crypto-pythia.es';
import {
    JwtGenerator,
    KeyEntryStorage,
    CardManager,
    VirgilCardVerifier,
    GeneratorJwtProvider,
    CachingJwtProvider,
} from 'virgil-sdk';
import { createBrainKey } from 'virgil-pythia';
import { CloudKeyStorage, KeyknoxManager, KeyknoxCrypto } from '@virgilsecurity/keyknox';
import { createThrottlingHandler } from '../utils/handlers';

export const virgilCrypto = new VirgilCrypto();
const cardCrypto = new VirgilCardCrypto(virgilCrypto);
const cardVerifier = new VirgilCardVerifier(cardCrypto);

export const generator = new JwtGenerator({
    appId: process.env.APP_ID!,
    apiKeyId: process.env.API_KEY_ID!,
    apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
    accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
});

export const mockProvider = new GeneratorJwtProvider(generator, undefined, 'default_identity');

export const cardManager = new CardManager({
    cardCrypto: cardCrypto,
    cardVerifier: cardVerifier,
    accessTokenProvider: mockProvider,
    retryOnUnauthorized: true,
});

export const keyStorage = new KeyEntryStorage('.virgil-local-storage');

export const createFetchToken = (identity: string) => () =>
    Promise.resolve(generator.generateToken(identity).toString());

export const createSyncStorage = async (identity: string, password: string) => {
    const fetchToken = createFetchToken(identity);
    const brainKey = createBrainKey({
        virgilCrypto: virgilCrypto,
        virgilPythiaCrypto: new VirgilPythiaCrypto(),
        accessTokenProvider: new CachingJwtProvider(fetchToken),
    });

    const errorHandler = createThrottlingHandler(brainKey, password);

    const keyPair = await brainKey.generateKeyPair(password).catch(errorHandler);

    const storage = new CloudKeyStorage(
        new KeyknoxManager(
            new CachingJwtProvider(fetchToken),
            keyPair.privateKey,
            keyPair.publicKey,
            undefined,
            new KeyknoxCrypto(virgilCrypto),
        ),
    );

    await storage.retrieveCloudEntries();
    return storage;
};

export const clear = () => keyStorage.clear();
