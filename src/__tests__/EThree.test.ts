import EThree from '../EThree';
import {
    JwtGenerator,
    KeyEntryStorage,
    CardManager,
    VirgilCardVerifier,
    GeneratorJwtProvider,
    IKeyEntry,
} from 'virgil-sdk';
import {
    VirgilCrypto,
    VirgilAccessTokenSigner,
    VirgilCardCrypto,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import { WrongKeyknoxPasswordError } from '../errors';

const virgilCrypto = new VirgilCrypto();
const cardCrypto = new VirgilCardCrypto(virgilCrypto);
const cardVerifier = new VirgilCardVerifier(cardCrypto);

export const generator = new JwtGenerator({
    appId: process.env.APP_ID!,
    apiKeyId: process.env.API_KEY_ID!,
    apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
    accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
});

const mockProvider = new GeneratorJwtProvider(generator);

const cardManager = new CardManager({
    cardCrypto: cardCrypto,
    cardVerifier: cardVerifier,
    accessTokenProvider: mockProvider,
    retryOnUnauthorized: true,
});

const keyStorage = new KeyEntryStorage({ name: 'keyknox-storage' });

describe('VirgilE2ee', () => {
    const identity = 'virgiltest' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

    it('should bootstrap', async done => {
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const privateKey = await keyStorage.load(identity);
        expect(privateKey).not.toEqual(null);
        done();
    });

    it('should lookup keys', async done => {
        const sdk = await EThree.init(fetchToken);
        const identity1 = 'virgiltestlookup1' + Date.now();
        const identity2 = 'virgiltestlookup2' + Date.now();
        const identity3 = 'virgiltestlookup3' + Date.now();
        const keypair1 = virgilCrypto.generateKeys();
        const keypair2 = virgilCrypto.generateKeys();
        const keypair3 = virgilCrypto.generateKeys();

        const cards = await Promise.all([
            cardManager.publishCard({ identity: identity1, ...keypair1 }),
            cardManager.publishCard({ identity: identity2, ...keypair2 }),
            cardManager.publishCard({ identity: identity3, ...keypair3 }),
        ]);
        const publicKeys = await sdk.lookupKeys([identity1, identity2, identity3]);

        expect(publicKeys.length).toBe(3);
        expect(virgilCrypto.exportPublicKey(publicKeys[0]).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair1.publicKey).toString('base64'),
        );
        expect(virgilCrypto.exportPublicKey(publicKeys[1]).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair2.publicKey).toString('base64'),
        );
        expect(virgilCrypto.exportPublicKey(publicKeys[2]).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair3.publicKey).toString('base64'),
        );
        done();
    });

    it('should encrypt decrypt', async done => {
        const sdk = await EThree.init(fetchToken);
        const [senderPublicKey] = await Promise.all([
            sdk.lookupKeys([identity]),
            sdk.bootstrap('secure_password'),
        ]);
        const receiver = virgilCrypto.generateKeys();
        const message = await sdk.encrypt('privet, neznakomets', [receiver.publicKey]);
        const decrypted = await sdk.decrypt(message, senderPublicKey);
        expect(decrypted).toBe('privet, neznakomets');
        done();
    });
});

describe('local bootstrap (without password)', () => {
    const identity = 'virgiltestlocal' + Date.now();

    it('has local key, has no card', async done => {
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const keyPair = virgilCrypto.generateKeys();
        await keyStorage.save({
            name: identity,
            value: virgilCrypto.exportPrivateKey(keyPair.privateKey),
        });
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        done();
    });

    it('has local key, has card', async done => {
        const key = await keyStorage.load(identity);
        expect(key).not.toBe(null);
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toEqual(1);
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        done();
    });

    it('has no local key, has card', async done => {
        await keyStorage.remove(identity);
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const sdk = await EThree.init(fetchToken);
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        try {
            await sdk.bootstrap();
        } catch (e) {
            expect(e).toBeDefined();
            return done();
        }
        done('should throw error');
    });

    it('has no local key, has no card', async done => {
        const identity = 'virgiltestlocalnokeynocard' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(0);
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const [cards, key] = await Promise.all([
            cardManager.searchCards(identity),
            keyStorage.load(identity),
        ]);
        expect(cards.length).toBe(1);
        expect(key).not.toBe(null);
        done();
    });
});

describe('remote bootstrap (with password)', () => {
    const identity = 'virgiltestremote' + Date.now();
    let prevKey: IKeyEntry;
    it('has no local key, has no card', async done => {
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(0);
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const [cards, key] = await Promise.all([
            cardManager.searchCards(identity),
            keyStorage.load(identity),
        ]);
        expect(cards.length).toBe(1);
        expect(key).not.toBe(null);
        prevKey = key!;
        done();
    });

    it('has no local key, has card', async done => {
        await keyStorage.clear();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(1);
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const [cards, key] = await Promise.all([
            cardManager.searchCards(identity),
            keyStorage.load(identity),
        ]);
        expect(cards.length).toBe(1);
        expect(key).not.toBe(null);
        expect(key!.value).toMatchObject(prevKey.value);
        done();
    });

    it('wrong password', async done => {
        await keyStorage.clear();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(1);
        const sdk = await EThree.init(fetchToken);
        try {
            await sdk.bootstrap('not_secret_password');
        } catch (e) {
            expect(e).toBeInstanceOf(WrongKeyknoxPasswordError);
            return done();
        }
        done('should throw error');
    });
});

describe('logout()', () => {
    it('should delete key on logout', async done => {
        const identity = 'virgiltestlogout' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap('secure_password');
        const isDeleted = await sdk.logout();
        const privateKey = await keyStorage.load(identity);
        expect(privateKey).toEqual(null);
        expect(isDeleted).toBe(true);
        done();
    });
});
