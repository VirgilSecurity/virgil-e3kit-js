import VirgilE2ee from '../VirgilE2ee';
import { JwtGenerator, KeyEntryStorage, CardManager, VirgilCardVerifier, GeneratorJwtProvider } from 'virgil-sdk';
import { VirgilCrypto, VirgilAccessTokenSigner, VirgilCardCrypto, VirgilPublicKey } from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';

const virgilCrypto = new VirgilCrypto();
const cardCrypto = new VirgilCardCrypto(virgilCrypto);
const cardVerifier = new VirgilCardVerifier(cardCrypto);

export const generator = new JwtGenerator({
    appId: process.env.APP_ID!,
    apiKeyId: process.env.API_KEY_ID!,
    apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
    accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
});

const cardManager = new CardManager({
    cardCrypto: cardCrypto,
    cardVerifier: cardVerifier,
    accessTokenProvider: new GeneratorJwtProvider(generator),
    retryOnUnauthorized: true,
});

describe('VirgilE2ee', () => {
    const identity = 'virgiltest' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

    it('should init', async done => {
        const sdk = await VirgilE2ee.init(fetchToken);
        expect(sdk.identity).toBe(identity);
        done();
    });

    it('should bootstrap', async done => {
        const sdk = await VirgilE2ee.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const storage = new KeyEntryStorage({ name: 'keyknox-storage' });
        const privateKey = await storage.load(identity);
        expect(privateKey).toBeDefined();
        done();
    });

    it('should encrypt decrypt', async done => {
        const sdk = await VirgilE2ee.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const receiver = virgilCrypto.generateKeys();
        const message = await sdk.encrypt('privet, neznakomets', [receiver.publicKey]);
        const decrypted = await sdk.decrypt(message);
        expect(decrypted).toBe('privet, neznakomets');
        done();
    });
});

describe('bootstrap successful', () => {
    const identity = 'virgiltestbootstrap' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
    let publicKey: VirgilPublicKey;

    it('should bootstrap normally and create card', async done => {
        const sdk = await VirgilE2ee.init(fetchToken);
        await sdk.bootstrap('secure_password');

        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        publicKey = cards[0]!.publicKey as VirgilPublicKey;
        done();
    });

    it('should bootstrap normally when we have a local private key (without password)', async done => {
        const sdk = await VirgilE2ee.init(fetchToken);
        await expect(() => sdk.bootstrap()).not.toThrow();
        const message = 'privet, merzavec';
        const encrypted = virgilCrypto.encrypt(message, [publicKey]).toString('base64');
        const decrypted = await sdk.decrypt(encrypted);
        expect(decrypted).toEqual(message);
        done();
    });
});
