import EThree from '../EThree';
import {
    JwtGenerator,
    KeyEntryStorage,
    CardManager,
    VirgilCardVerifier,
    GeneratorJwtProvider,
    IKeyEntry,
    CachingJwtProvider,
} from 'virgil-sdk';
import {
    VirgilCrypto,
    VirgilAccessTokenSigner,
    VirgilCardCrypto,
    VirgilPublicKey,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import {
    WrongKeyknoxPasswordError,
    EmptyArrayError,
    BootstrapRequiredError,
    LookupError,
    LookupNotFoundError,
} from '../errors';
import VirgilToolbox from '../VirgilToolbox';

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

    it('STA-1 has no local key, has no card', async done => {
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

describe('lookupKeys', () => {
    const identity = 'virgiltestlookup' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

    it('STE-1 lookupKeys success', async done => {
        const sdk = await EThree.init(fetchToken);
        const identity1 = 'virgiltestlookup1' + Date.now();
        const identity2 = 'virgiltestlookup2' + Date.now();
        const identity3 = 'virgiltestlookup3' + Date.now();
        const keypair1 = virgilCrypto.generateKeys();
        const keypair2 = virgilCrypto.generateKeys();
        const keypair3 = virgilCrypto.generateKeys();

        await Promise.all([
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

    it('lookupKeys nonexistent identity', async done => {
        const sdk = await EThree.init(fetchToken);
        const identity1 = 'virgiltestlookupnonexist' + Date.now();
        const identity2 = 'virgiltestlookupnonexist' + Date.now();
        try {
            await sdk.lookupKeys([identity1, identity2]);
        } catch (e) {
            expect(e.rejected.length).toBe(2);
            expect(e.rejected[0]).toBeInstanceOf(LookupNotFoundError);
            expect(e.rejected[1]).toBeInstanceOf(LookupNotFoundError);
            return done();
        }

        return done('should throw');
    });

    it('lookupKeys with error', async done => {
        const identity1 = 'virgiltestlookuperror1' + Date.now();
        const keypair1 = virgilCrypto.generateKeys();

        VirgilToolbox.prototype.getPublicKey = jest
            .fn()
            .mockResolvedValueOnce(keypair1.publicKey as VirgilPublicKey)
            .mockRejectedValueOnce(new Error('something happens'))
            .mockRejectedValueOnce(new LookupNotFoundError('not exists'));

        const provider = new CachingJwtProvider(fetchToken);

        const sdk = new EThree(identity, provider, new VirgilToolbox(provider));

        await Promise.all([cardManager.publishCard({ identity: identity1, ...keypair1 })]);

        try {
            const res = await sdk.lookupKeys([identity1, 'not exists', 'with error']);
            expect(res).not.toBeDefined();
        } catch (e) {
            expect(e).toBeInstanceOf(LookupError);
            expect(e.resolved.length).toBe(1);
            expect(e.rejected.length).toBe(2);
            expect(e.rejected[0]).toBeInstanceOf(Error);
            expect(e.rejected[1]).toBeInstanceOf(LookupNotFoundError);
            return done();
        }
        done('should throw');
    });

    it('STE-2 lookupKeys with empty array of identities', async done => {
        const sdk = await EThree.init(fetchToken);
        try {
            await sdk.lookupKeys([]);
        } catch (e) {
            expect(e).toBeInstanceOf(EmptyArrayError);
            return done();
        }
        done('should throw');
    });
});

describe('encrypt and decrypt', () => {
    const identity = 'virgiltestencrypt' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

    it('STE-3 ', async done => {
        const identity1 = 'virgiltestencrypt1' + Date.now();
        const identity2 = 'virgiltestencrypt2' + Date.now();

        const fetchToken1 = () => Promise.resolve(generator.generateToken(identity1).toString());
        const fetchToken2 = () => Promise.resolve(generator.generateToken(identity2).toString());

        const [sdk1, sdk2] = await Promise.all([
            EThree.init(fetchToken1),
            EThree.init(fetchToken2),
        ]);

        const unusedKeypair = virgilCrypto.generateKeys();

        await Promise.all([sdk1.bootstrap(), sdk2.bootstrap()]);
        const message = 'encrypt, decrypt, repeat';
        const sdk1PublicKeys = await sdk1.lookupKeys([identity1]);
        const sdk2PublicKeys = await sdk2.lookupKeys([identity2]);
        const encryptedMessage = await sdk1.encrypt(message, sdk2PublicKeys);
        try {
            await sdk2.decrypt(encryptedMessage, [unusedKeypair.publicKey]);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        const decryptedMessage = await sdk2.decrypt(encryptedMessage, sdk1PublicKeys);
        expect(decryptedMessage).toEqual(message);
        done();
    });

    it('STE-4 encrypt for empty public keys', async done => {
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        try {
            await sdk.encrypt('privet', []);
        } catch (e) {
            expect(e).toBeInstanceOf(EmptyArrayError);
            return done();
        }
        done('should throw');
    });

    it('STE-5 decrypt for empty public keys', async done => {
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const keyPair = virgilCrypto.generateKeys();
        const message = await sdk.encrypt('privet', [keyPair.publicKey]);
        try {
            await sdk.decrypt(message, []);
        } catch (e) {
            expect(e).toBeInstanceOf(EmptyArrayError);
            return done();
        }
        done('should throw');
    });

    it('STE-6 encrypt and decrypt without public keys', async done => {
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const message = 'secret message';
        const encryptedMessage = await sdk.encrypt(message);
        const decryptedMessage = await sdk.decrypt(encryptedMessage);
        expect(decryptedMessage).toEqual(message);
        done();
    });

    it('STE-7 decrypt message without sign', async done => {
        const sdk = await EThree.init(fetchToken);
        await sdk.bootstrap();
        const receiverPublicKey = await sdk.lookupKeys([identity]);
        const { publicKey: senderPublicKey } = virgilCrypto.generateKeys();
        const message = 'encrypted, but not signed :)';
        const encryptedMessage = await virgilCrypto
            .encrypt(message, receiverPublicKey)
            .toString('base64');
        try {
            await sdk.decrypt(encryptedMessage, [senderPublicKey]);
        } catch (e) {
            expect(e).toBeDefined();
            return done();
        }
        done('should throw');
    });

    it('STE-8 no decrypt/encrypt before bootstrap', async done => {
        await keyStorage.clear();
        const sdk = await EThree.init(fetchToken);
        try {
            await sdk.encrypt('message');
        } catch (e) {
            expect(e).toBeInstanceOf(BootstrapRequiredError);
        }
        try {
            await sdk.decrypt('message');
        } catch (e) {
            expect(e).toBeInstanceOf(BootstrapRequiredError);
        }
        done();
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
