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
import {
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    KeyknoxClient,
} from '@virgilsecurity/keyknox';
import { EThree } from '..';
import { generateBrainPair } from '../utils/brainkey';

export const virgilCrypto = new VirgilCrypto();
const cardCrypto = new VirgilCardCrypto(virgilCrypto);
const cardVerifier = new VirgilCardVerifier(cardCrypto, {
    verifySelfSignature: false,
    verifyVirgilSignature: false,
});

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
    apiUrl: process.env.API_URL,
});

export const keyStorage = new KeyEntryStorage('.virgil-local-storage');

export const createFetchToken = (identity: string) => () =>
    Promise.resolve(generator.generateToken(identity).toString());

export const initializeEThree = (fetchToken: () => Promise<string>) =>
    EThree.initialize(fetchToken, { apiUrl: process.env.API_URL });

export const createSyncStorage = async (identity: string, password: string) => {
    const fetchToken = createFetchToken(identity);

    const keyPair = await generateBrainPair(password, {
        virgilCrypto: virgilCrypto,
        pythiaCrypto: new VirgilPythiaCrypto(),
        accessTokenProvider: new CachingJwtProvider(fetchToken),
        apiUrl: process.env.API_URL,
    });

    const storage = new CloudKeyStorage(
        new KeyknoxManager(
            new CachingJwtProvider(fetchToken),
            keyPair.privateKey,
            keyPair.publicKey,
            new KeyknoxClient(process.env.API_URL),
            new KeyknoxCrypto(virgilCrypto),
        ),
    );

    await storage.retrieveCloudEntries();
    return storage;
};

export const clear = () => keyStorage.clear();
