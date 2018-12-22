import EThree from '../EThree';
import {
    EmptyArrayError,
    RegisterRequiredError,
    LookupNotFoundError,
    PrivateKeyAlreadyExistsError,
    IdentityAlreadyExistsError,
    WrongKeyknoxPasswordError,
    LookupError,
    DUPLICATE_IDENTITIES,
    PrivateKeyNoBackupError,
} from '../errors';
import {
    generator,
    clear,
    createSyncStorage,
    keyStorage,
    cardManager,
    createFetchToken,
    virgilCrypto,
} from './utils';
import { IKeyEntry } from 'virgil-sdk';
import { getObjectValues } from '../utils/array';

describe('VirgilE2ee', () => {
    const identity = 'virgiltest' + Date.now();
    const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
    clear();

    it('full integration test', async done => {
        const sdk = await EThree.initialize(fetchToken);
        const pwd = 'secret_password';
        const cloudStorage = await createSyncStorage(identity, pwd);
        await sdk.register();
        const privateKey = await keyStorage.load(identity);
        expect(privateKey).not.toEqual(null);
        await sdk.backupPrivateKey(pwd);
        const encrypted = (await sdk.encrypt('message')) as string;
        await sdk.cleanup();
        const key = await keyStorage.load(identity);
        expect(key).toBeNull();

        try {
            await sdk.decrypt(encrypted);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }

        await sdk.resetPrivateKeyBackup(pwd);
        try {
            const cloudKey = await cloudStorage.retrieveEntry(identity);
            expect(cloudKey).not.toBeDefined();
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }

        done();
    });
});

describe('EThree.register()', () => {
    clear();
    it('STA-9 has no local key, has no card', async done => {
        const identity = 'virgiltestlocalnokeynocard' + Date.now();
        const fetchToken = createFetchToken(identity);
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(0);
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const [cards, key] = await Promise.all([
            cardManager.searchCards(identity),
            keyStorage.load(identity),
        ]);
        expect(cards.length).toBe(1);
        expect(key).not.toBe(null);
        done();
    });

    it('has local key, has no card', async done => {
        const identity = 'virgiltestlocal2' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        const keyPair = virgilCrypto.generateKeys();
        await keyStorage.save({
            name: identity,
            value: virgilCrypto.exportPrivateKey(keyPair.privateKey),
        });
        await sdk.register();
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        done();
    });

    it('STE-10 has card', async done => {
        const identity = 'virgiltestlocal3' + Date.now();
        const keyPair = virgilCrypto.generateKeys();
        await cardManager.publishCard({ identity: identity, ...keyPair });
        await keyStorage.save({
            name: identity,
            value: virgilCrypto.exportPrivateKey(keyPair.privateKey),
        });
        const fetchToken = createFetchToken(identity);
        const prevCards = await cardManager.searchCards(identity);

        expect(prevCards.length).toEqual(1);

        const sdk = await EThree.initialize(fetchToken);
        try {
            await sdk.register();
        } catch (e) {
            expect(e).toBeInstanceOf(IdentityAlreadyExistsError);
        }

        done();
    });

    it('STE-11 call 2 times', async done => {
        const identity = 'virgiltestregister' + Date.now();
        const fetchToken = createFetchToken(identity);
        const prevCards = await cardManager.searchCards(identity);
        expect(prevCards.length).toBe(0);
        const sdk = await EThree.initialize(fetchToken);
        const promise = sdk.register();
        try {
            await sdk.register();
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        await promise;
        const [cards, key] = await Promise.all([
            cardManager.searchCards(identity),
            keyStorage.load(identity),
        ]);
        expect(cards.length).toBe(1);
        expect(key).not.toBe(null);
        done();
    });
});

describe('EThree.rotatePrivateKey', () => {
    clear();

    it('STE-14 has card', async done => {
        const identity = 'virgiltestrotate1' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        const keypair = virgilCrypto.generateKeys();
        const prevCard = await cardManager.publishCard({ identity: identity, ...keypair });
        await sdk.rotatePrivateKey();
        const newCards = await cardManager.searchCards(identity);
        expect(newCards.length).toBe(1);
        expect(newCards[0].previousCardId).toBe(prevCard.id);
        done();
    });

    it('STE-12 has no card', async done => {
        const identity = 'virgiltestrotate2' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(0);
        try {
            await sdk.rotatePrivateKey();
        } catch (e) {
            expect(e).toBeInstanceOf(RegisterRequiredError);
            return done();
        }
        done('should throw');
    });

    it('STE-10 rotate 2 times', async done => {
        const identity = 'virgiltestrotate3' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const cards = await cardManager.searchCards(identity);
        expect(cards.length).toEqual(1);
        await sdk.cleanup();
        const promise = sdk.rotatePrivateKey();
        try {
            await sdk.rotatePrivateKey();
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        await promise;
        const newCards = await cardManager.searchCards(identity);
        expect(newCards.length).toBe(1);
        expect(newCards[0].previousCardId).toBe(cards[0].id);
        done();
    });
});

describe('lookupPublicKeys', () => {
    clear();

    it('lookupPublicKeys for one identity success', async done => {
        const identity1 = 'virgiltestlookup1' + Date.now();
        const identity2 = 'virgiltestlookup2' + Date.now();
        const fetchToken = createFetchToken(identity1);
        const sdk = await EThree.initialize(fetchToken);
        const keypair = virgilCrypto.generateKeys();
        await cardManager.publishCard({ identity: identity2, ...keypair });
        const lookupResult = await sdk.lookupPublicKeys(identity2);

        expect(Array.isArray(lookupResult)).not.toBeTruthy();
        expect(virgilCrypto.exportPublicKey(lookupResult).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair.publicKey).toString('base64'),
        );
        done();
    });

    it('STE-1 lookupKeys success', async done => {
        const identity = 'virgiltestlookup' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        const identity1 = 'virgiltestlookup1' + Date.now();
        const identity2 = 'virgiltestlookup2' + Date.now();
        const keypair1 = virgilCrypto.generateKeys();
        const keypair2 = virgilCrypto.generateKeys();

        await Promise.all([
            cardManager.publishCard({ identity: identity1, ...keypair1 }),
            cardManager.publishCard({ identity: identity2, ...keypair2 }),
        ]);
        const publicKeys = await sdk.lookupPublicKeys([identity1, identity2]);

        expect(getObjectValues(publicKeys).length).toBe(2);
        expect(virgilCrypto.exportPublicKey(publicKeys[identity1]).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair1.publicKey).toString('base64'),
        );
        expect(virgilCrypto.exportPublicKey(publicKeys[identity2]).toString('base64')).toEqual(
            virgilCrypto.exportPublicKey(keypair2.publicKey).toString('base64'),
        );
        done();
    });

    it('STE-2 lookupKeys nonexistent identity', async () => {
        const identity = 'virgiltestlookup' + Date.now();
        const fetchToken = createFetchToken(identity);
        const sdk = await EThree.initialize(fetchToken);
        const identity1 = 'virgiltestlookupnonexist1' + Date.now();
        const identity2 = 'virgiltestlookupnonexist2' + Date.now();
        try {
            await sdk.lookupPublicKeys([identity1, identity2]);
        } catch (e) {
            expect(e).toBeInstanceOf(LookupError);
            if (e instanceof LookupError) {
                expect(e.lookupResult[identity1]).toBeInstanceOf(LookupNotFoundError);
                expect(e.lookupResult[identity2]).toBeInstanceOf(LookupNotFoundError);
            }
            return;
        }

        throw 'should throw';
    });

    it('STE-2 lookupKeys with empty array of identities', async () => {
        const identity = 'virgiltestlookup' + Date.now();
        const fetchToken = createFetchToken(identity);

        const sdk = await EThree.initialize(fetchToken);
        try {
            await sdk.lookupPublicKeys([]);
        } catch (e) {
            expect(e).toBeInstanceOf(EmptyArrayError);
            return;
        }
        throw 'should throw';
    });

    it('lookupKeys with duplicate identites', async done => {
        const identity = 'virgiltestlookup' + Date.now();
        const fetchToken = createFetchToken(identity);

        const sdk = await EThree.initialize(fetchToken);
        try {
            await sdk.lookupPublicKeys([identity, identity, 'random']);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
            expect(e.message).toEqual(DUPLICATE_IDENTITIES);
            return done();
        }
        done('should throw');
    });
});

describe('change password', () => {
    clear();
    it('should change password', async done => {
        const identity = 'virgiltest' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const oldPwd = 'old_password';
        const newPwd = 'new_password';
        try {
            const sdk = await EThree.initialize(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(oldPwd);
            await sdk.cleanup();
            await sdk.changePassword(oldPwd, newPwd);
            await sdk.restorePrivateKey(newPwd);
        } catch (e) {
            expect(e).not.toBeDefined();
            return done(e);
        }
        done();
    });

    it('wrong old password', async done => {
        const identity = 'virgiltest' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const oldPwd = 'old_password';
        const newPwd = 'new_password';
        const wrongPwd = 'wrong_password';
        try {
            const sdk = await EThree.initialize(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(oldPwd);
            await sdk.changePassword(wrongPwd, newPwd);
        } catch (e) {
            expect(e).toBeInstanceOf(WrongKeyknoxPasswordError);
            return done();
        }
        done('should throw');
    });
});

describe('backupPrivateKey', () => {
    it('success', async done => {
        const identity = 'virgiltestbackup1' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const pwd = 'secret_password';
        const sdk = await EThree.initialize(fetchToken);
        const storage = await createSyncStorage(identity, pwd);

        try {
            await storage.retrieveEntry(identity);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }

        try {
            await sdk.register();
            await sdk.backupPrivateKey(pwd);
        } catch (e) {
            expect(e).not.toBeDefined();
        }
        await storage.retrieveCloudEntries();
        const key = await storage.retrieveEntry(identity);
        expect(key).not.toBeNull();
        done();
    });

    it('No local private key', async done => {
        const identity = 'virgiltestbackup2' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const sdk = await EThree.initialize(fetchToken);
        try {
            await sdk.backupPrivateKey('secret_pass');
        } catch (e) {
            expect(e).toBeInstanceOf(RegisterRequiredError);
            return done();
        }
        return done('should throw');
    });
});

describe('restorePrivateKey', () => {
    clear();
    it('has no private key', async done => {
        const pwd = 'secret_password';
        const identity = 'virgiltestrestore1' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        const storage = await createSyncStorage(identity, pwd);

        try {
            await storage.retrieveEntry(identity);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        let privateKey: IKeyEntry | null;
        try {
            await sdk.register();
            privateKey = await keyStorage.load(identity);
            await sdk.backupPrivateKey(pwd);
            await sdk.cleanup();
        } catch (e) {
            expect(e).not.toBeDefined();
        }
        const noPrivateKey = await keyStorage.load(identity);
        expect(noPrivateKey).toBeFalsy();
        await sdk.restorePrivateKey(pwd);
        const restoredPrivateKey = await keyStorage.load(identity);
        expect(restoredPrivateKey!.value.toString('base64')).toEqual(
            privateKey!.value.toString('base64'),
        );

        done();
    });

    it('has private key', async done => {
        const pwd = 'secret_password';
        const identity = 'virgiltestrestore1' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        const storage = await createSyncStorage(identity, pwd);

        try {
            await storage.retrieveEntry(identity);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        try {
            await sdk.register();
            await sdk.backupPrivateKey(pwd);
        } catch (e) {
            expect(e).not.toBeDefined();
        }

        const noPrivateKey = await keyStorage.load(identity);
        expect(noPrivateKey).toBeTruthy();
        try {
            await sdk.restorePrivateKey(pwd);
        } catch (e) {
            expect(e).toBeInstanceOf(PrivateKeyAlreadyExistsError);
            return done();
        }
        done('should throw');
    });
});

describe('encrypt and decrypt', () => {
    clear();

    it('STE-3 ', async done => {
        const identity1 = 'virgiltestencrypt1' + Date.now();
        const identity2 = 'virgiltestencrypt2' + Date.now();

        const fetchToken1 = () => Promise.resolve(generator.generateToken(identity1).toString());
        const fetchToken2 = () => Promise.resolve(generator.generateToken(identity2).toString());

        const [sdk1, sdk2] = await Promise.all([
            EThree.initialize(fetchToken1),
            EThree.initialize(fetchToken2),
        ]);

        await Promise.all([sdk1.register(), sdk2.register()]);
        const message = 'encrypt, decrypt, repeat';
        const sdk1PublicKeys = await sdk1.lookupPublicKeys([identity1]);
        const sdk2PublicKeys = await sdk2.lookupPublicKeys([identity1, identity2]);
        const encryptedMessage = await sdk1.encrypt(message, sdk2PublicKeys);
        try {
            await sdk2.decrypt(encryptedMessage);
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
        }
        const decryptedMessage = await sdk2.decrypt(encryptedMessage, sdk1PublicKeys[identity1]);
        expect(decryptedMessage).toEqual(message);
        done();
    });

    it('STE-5 encrypt for one public key', async done => {
        const identity = 'virgiltestencrypt' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        const { publicKey } = virgilCrypto.generateKeys();
        await sdk.register();
        try {
            await sdk.encrypt('privet', publicKey);
        } catch (e) {
            expect(e).not.toBeDefined();
        }
        done();
    });

    it('STE-6 encrypt and decrypt without public keys', async done => {
        const identity = 'virgiltestencrypt' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const message = 'secret message';
        const encryptedMessage = await sdk.encrypt(message);
        const decryptedMessage = await sdk.decrypt(encryptedMessage);
        expect(decryptedMessage).toEqual(message);
        done();
    });

    it('STE-7 decrypt message without sign', async done => {
        const identity = 'virgiltestencrypt' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const receiverPublicKey = await sdk.lookupPublicKeys([identity]);
        const { publicKey: senderPublicKey } = virgilCrypto.generateKeys();
        const message = 'encrypted, but not signed :)';
        const encryptedMessage = await virgilCrypto
            .encrypt(message, receiverPublicKey[identity])
            .toString('base64');
        try {
            await sdk.decrypt(encryptedMessage, senderPublicKey);
        } catch (e) {
            expect(e).toBeDefined();
            return done();
        }
        done('should throw');
    });

    it('STE-8 no decrypt/encrypt before register', async done => {
        const identity = 'virgiltestencrypt' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        await keyStorage.clear();
        const sdk = await EThree.initialize(fetchToken);
        try {
            await sdk.encrypt('message');
        } catch (e) {
            expect(e).toBeInstanceOf(RegisterRequiredError);
        }
        try {
            await sdk.decrypt('message');
        } catch (e) {
            expect(e).toBeInstanceOf(RegisterRequiredError);
        }
        done();
    });

    it('should return buffer', async done => {
        const identity = 'virgiltestencryptbuffer' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const buf = new Buffer('123');

        const recipient = virgilCrypto.generateKeys();
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const publicKey = (await sdk.lookupPublicKeys([identity]))[0];
        const encryptedMessage = await sdk.encrypt(buf, recipient.publicKey);
        expect(encryptedMessage).toBeInstanceOf(Buffer);

        const resp = await sdk.decrypt(encryptedMessage, publicKey);
        expect(resp).toBeInstanceOf(Buffer);
        done();
    });
});

describe('cleanup()', () => {
    clear();
    it('local and remote key exists', async done => {
        const identity = 'virgiltestlogout' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());

        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        await sdk.cleanup();
        const privateKeyFromLocalStorage = await keyStorage.load(identity);
        expect(privateKeyFromLocalStorage).toEqual(null);
        done();
    });
});

describe('resetPrivateKeyBackup(pwd)', () => {
    it('reset backup private key', async done => {
        const pwd = 'secure_password';
        const identity = 'virgiltestlogout1' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const cloudStorage = await createSyncStorage(identity, pwd);
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        await sdk.backupPrivateKey(pwd);

        try {
            await sdk.resetPrivateKeyBackup(pwd);
        } catch (e) {
            expect(e).not.toBeDefined();
        }

        try {
            await cloudStorage.retrieveEntry(identity);
        } catch (e) {
            expect(e).toBeTruthy();
        }

        return done();
    });

    it('reset backup private key when no backup', async done => {
        const pwd = 'secure_password';
        const identity = 'virgiltestlogout2' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();

        try {
            await sdk.resetPrivateKeyBackup(pwd);
        } catch (e) {
            expect(e).toBeInstanceOf(PrivateKeyNoBackupError);
            return done();
        }
        done('should throw');
    });
});

describe('hasPrivateKey()', () => {
    it('has private key', async done => {
        const identity = 'virgiltesthasprivatekey1' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const sdk = await EThree.initialize(fetchToken);
        await sdk.register();
        const hasPrivateKey = await sdk.hasLocalPrivateKey();
        expect(hasPrivateKey).toEqual(true);
        return done();
    });

    it('has no private key', async done => {
        const identity = 'virgiltesthasprivatekey2' + Date.now();
        const fetchToken = () => Promise.resolve(generator.generateToken(identity).toString());
        const sdk = await EThree.initialize(fetchToken);
        const hasPrivateKey = await sdk.hasLocalPrivateKey();
        expect(hasPrivateKey).toEqual(false);
        return done();
    });
});
