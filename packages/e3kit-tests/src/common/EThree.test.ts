import { expect } from 'chai';
import isBuffer from 'is-buffer';
import uuid from 'uuid/v4';

import {
    IdentityAlreadyExistsError,
    RegisterRequiredError,
    LookupError,
    LookupNotFoundError,
    WrongKeyknoxPasswordError,
    PrivateKeyAlreadyExistsError,
    PrivateKeyNoBackupError,
    MissingPrivateKeyError,
    EThree,
} from '@virgilsecurity/e3kit-node';
import {
    KeyknoxManager,
    KeyknoxClient,
    KeyknoxCrypto,
    CloudKeyStorage,
} from '@virgilsecurity/keyknox';
import { initPythia, VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import {
    initCrypto,
    VirgilCardCrypto,
    VirgilAccessTokenSigner,
    VirgilCrypto,
    KeyPairType,
} from 'virgil-crypto';
import { createBrainKey } from 'virgil-pythia';
import {
    VirgilCardVerifier,
    JwtGenerator,
    CachingJwtProvider,
    GeneratorJwtProvider,
    CardManager,
    KeyEntryStorage,
} from 'virgil-sdk';

import { sleep } from './utils';

type VirgilPublicKey = import('virgil-crypto').VirgilPublicKey;
type IKeyEntry = import('virgil-sdk').IKeyEntry;

const BRAIN_KEY_RATE_LIMIT_DELAY = 2000;

describe('EThree', () => {
    let virgilCrypto: VirgilCrypto;
    let virgilCardCrypto: VirgilCardCrypto;
    let virgilCardVerifier: VirgilCardVerifier;
    let jwtGenerator: JwtGenerator;
    let generatorJwtProvider: GeneratorJwtProvider;
    let cardManager: CardManager;
    let keyEntryStorage: KeyEntryStorage;

    before(async () => {
        await Promise.all([initCrypto(), initPythia()]);
    });

    beforeEach(async () => {
        virgilCrypto = new VirgilCrypto();
        virgilCardCrypto = new VirgilCardCrypto(virgilCrypto);
        virgilCardVerifier = new VirgilCardVerifier(virgilCardCrypto, {
            verifySelfSignature: false,
            verifyVirgilSignature: false,
        });
        jwtGenerator = new JwtGenerator({
            appId: process.env.APP_ID!,
            apiKeyId: process.env.APP_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.APP_KEY!),
            accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
        });
        generatorJwtProvider = new GeneratorJwtProvider(
            jwtGenerator,
            undefined,
            'default_identity',
        );
        cardManager = new CardManager({
            cardCrypto: virgilCardCrypto,
            cardVerifier: virgilCardVerifier,
            accessTokenProvider: generatorJwtProvider,
            retryOnUnauthorized: true,
            apiUrl: process.env.API_URL,
        });
        keyEntryStorage = new KeyEntryStorage('.virgil-local-storage');
        await keyEntryStorage.clear();
    });

    const createFetchToken = (identity: string) => () =>
        Promise.resolve(jwtGenerator.generateToken(identity).toString());

    const initializeEThree = (fetchToken: () => Promise<string>) =>
        EThree.initialize(fetchToken, {
            apiUrl: process.env.API_URL,
            groupStorageName: `.virgil-group-storage/${uuid()}`,
            keyPairType: KeyPairType.ED25519,
        });

    const createSyncStorage = async (identity: string, password: string) => {
        await sleep(BRAIN_KEY_RATE_LIMIT_DELAY);
        const fetchToken = createFetchToken(identity);
        const brainKey = createBrainKey({
            virgilCrypto: virgilCrypto,
            virgilBrainKeyCrypto: new VirgilBrainKeyCrypto(),
            accessTokenProvider: new CachingJwtProvider(fetchToken),
            apiUrl: process.env.API_URL,
        });
        const keyPair = await brainKey.generateKeyPair(password);
        const storage = new CloudKeyStorage(
            new KeyknoxManager(
                new KeyknoxCrypto(virgilCrypto),
                new KeyknoxClient(new CachingJwtProvider(fetchToken), process.env.API_URL),
            ),
            keyPair.privateKey,
            keyPair.publicKey,
        );
        await storage.retrieveCloudEntries();
        return storage;
    };

    describe('derivePasswords', () => {
        it('derives passwords', async () => {
            const password = 'password';
            const loginPasswordBase64 = '8AfkqegTXFuyufUkwZ7u9s6x8xc9CjtZANqIjmueS40=';
            const backupPasswordBase64 = 'R/NHBt3Bv4ZIRPNEFirMH5GnRS1F/Rz64mYq1f+g+aU=';
            const { loginPassword, backupPassword } = await EThree.derivePasswords(password);
            expect(loginPassword.toString('base64')).equals(loginPasswordBase64);
            expect(backupPassword.toString('base64')).equals(backupPasswordBase64);
        });
    });

    describe('EThree.register()', () => {
        it('STA-9 has no local key, has no card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const prevCards = await cardManager.searchCards(identity);
            expect(prevCards.length).to.equal(0);
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards).to.have.length(1);
            expect(key).not.to.be.null;
        });

        it('has local key, has no card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const keyPair = virgilCrypto.generateKeys();
            await keyEntryStorage.save({
                name: identity,
                value: virgilCrypto.exportPrivateKey(keyPair.privateKey).toString('base64'),
            });
            await sdk.register();
            const cards = await cardManager.searchCards(identity);
            expect(cards).to.have.length(1);
        });

        it('STE-10 has card', async () => {
            const identity = uuid();
            const keyPair = virgilCrypto.generateKeys();
            await cardManager.publishCard({ identity: identity, ...keyPair });
            await keyEntryStorage.save({
                name: identity,
                value: virgilCrypto.exportPrivateKey(keyPair.privateKey).toString('base64'),
            });
            const fetchToken = createFetchToken(identity);
            const prevCards = await cardManager.searchCards(identity);
            expect(prevCards).to.have.length(1);
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.register();
            } catch (e) {
                expect(e).to.be.instanceOf(IdentityAlreadyExistsError);
                return;
            }
            expect.fail();
        });

        it('STE-11 call 2 times', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const prevCards = await cardManager.searchCards(identity);
            expect(prevCards).to.have.length(0);
            const sdk = await initializeEThree(fetchToken);
            const promise = sdk.register();
            try {
                await sdk.register();
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            await promise;
            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards).to.have.length(1);
            expect(key).not.to.be.null;
        });

        it('STE-44 registers with provided key pair', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const keyPair = sdk.virgilCrypto.generateKeys();
            await sdk.register(keyPair);
            const cards = await cardManager.searchCards(identity);
            expect(cards[0].identity).to.equal(identity);
            const keyEntry = await keyEntryStorage.load(identity);
            expect(keyEntry).not.to.be.undefined;
        });
    });

    describe('EThree.rotatePrivateKey', () => {
        it('STE-14 has card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const keypair = virgilCrypto.generateKeys();
            const prevCard = await cardManager.publishCard({ identity: identity, ...keypair });
            await sdk.rotatePrivateKey();
            const newCards = await cardManager.searchCards(identity);
            expect(newCards).to.have.length(1);
            expect(newCards[0].previousCardId).to.equal(prevCard.id);
        });

        it('STE-12 has no card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const cards = await cardManager.searchCards(identity);
            expect(cards).to.have.length(0);
            try {
                await sdk.rotatePrivateKey();
            } catch (e) {
                expect(e).to.be.instanceOf(RegisterRequiredError);
                return;
            }
            expect.fail();
        });

        it('STE-10 rotate 2 times', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const cards = await cardManager.searchCards(identity);
            expect(cards).to.have.length(1);
            await sdk.cleanup();
            const promise = sdk.rotatePrivateKey();
            try {
                await sdk.rotatePrivateKey();
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            await promise;
            const newCards = await cardManager.searchCards(identity);
            expect(newCards).to.have.length(1);
            expect(newCards[0].previousCardId).to.equal(cards[0].id);
        });
    });

    describe('lookupPublicKeys', () => {
        it('lookupPublicKeys for one identity success', async () => {
            const identity1 = uuid();
            const identity2 = uuid();
            const fetchToken = createFetchToken(identity1);
            const sdk = await initializeEThree(fetchToken);
            const keypair = virgilCrypto.generateKeys();
            await cardManager.publishCard({ identity: identity2, ...keypair });
            const lookupResult = (await sdk.lookupPublicKeys(identity2)) as VirgilPublicKey;
            expect(Array.isArray(lookupResult)).to.be.false;
            expect(
                virgilCrypto
                    .exportPublicKey(lookupResult)
                    .equals(virgilCrypto.exportPublicKey(keypair.publicKey)),
            ).to.be.true;
        });

        it('STE-1 lookupKeys success', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const identity1 = uuid();
            const identity2 = uuid();
            const keypair1 = virgilCrypto.generateKeys();
            const keypair2 = virgilCrypto.generateKeys();
            await Promise.all([
                cardManager.publishCard({ identity: identity1, ...keypair1 }),
                cardManager.publishCard({ identity: identity2, ...keypair2 }),
            ]);
            const publicKeys = await sdk.lookupPublicKeys([identity1, identity2]);
            expect(Object.values(publicKeys)).to.have.length(2);
            expect(
                virgilCrypto
                    .exportPublicKey(publicKeys[identity1] as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(keypair1.publicKey)),
            ).to.be.true;
            expect(
                virgilCrypto
                    .exportPublicKey(publicKeys[identity2] as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(keypair2.publicKey)),
            ).to.be.true;
        });

        it('STE-2 lookupKeys nonexistent identity', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const identity1 = uuid();
            const identity2 = uuid();
            try {
                await sdk.lookupPublicKeys([identity1, identity2]);
            } catch (e) {
                expect(e).to.be.instanceOf(LookupError);
                expect(e.lookupResult[identity1]).to.be.instanceOf(LookupNotFoundError);
                expect(e.lookupResult[identity2]).to.be.instanceOf(LookupNotFoundError);
                return;
            }
            expect.fail();
        });

        it('STE-2 lookupKeys with empty array of identities', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.lookupPublicKeys([]);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });

        it('lookupKeys with duplicate identites', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.lookupPublicKeys([identity, identity, 'random']);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });
    });

    describe('change password', () => {
        it('should change password', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const oldPwd = 'old_password';
            const newPwd = 'new_password';
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(oldPwd);
            await sdk.cleanup();
            await sdk.changePassword(oldPwd, newPwd);
            await sdk.restorePrivateKey(newPwd);
            const hasKey = await sdk.hasLocalPrivateKey();
            expect(hasKey).to.be.true;
        });

        it('wrong old password', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const oldPwd = 'old_password';
            const newPwd = 'new_password';
            const wrongPwd = 'wrong_password';
            try {
                const sdk = await initializeEThree(fetchToken);
                await sdk.register();
                await sdk.backupPrivateKey(oldPwd);
                await sdk.changePassword(wrongPwd, newPwd);
            } catch (e) {
                expect(e).to.be.instanceOf(WrongKeyknoxPasswordError);
                return;
            }
            expect.fail();
        });
    });

    describe('backupPrivateKey', () => {
        it('success', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const pwd = 'secret_password';
            const sdk = await initializeEThree(fetchToken);
            const storage = await createSyncStorage(identity, pwd);
            try {
                storage.retrieveEntry(identity);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            try {
                await sdk.register();
                await sdk.backupPrivateKey(pwd);
            } catch (e) {
                expect(e).to.be.undefined;
            }
            await storage.retrieveCloudEntries();
            const key = storage.retrieveEntry(identity);
            expect(key).not.to.be.null;
        });

        it('No local private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.backupPrivateKey('secret_pass');
            } catch (e) {
                expect(e).to.be.instanceOf(MissingPrivateKeyError);
                return;
            }
            expect.fail();
        });
    });

    describe('restorePrivateKey', () => {
        it('has no private key', async () => {
            const pwd = 'secret_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            const storage = await createSyncStorage(identity, pwd);
            try {
                storage.retrieveEntry(identity);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            let privateKey: IKeyEntry | null;
            try {
                await sdk.register();
                privateKey = await keyEntryStorage.load(identity);
                await sdk.backupPrivateKey(pwd);
                await sdk.cleanup();
            } catch (e) {
                expect(e).to.be.undefined;
            }
            const noPrivateKey = await keyEntryStorage.load(identity);
            expect(noPrivateKey).to.be.null;
            await sdk.restorePrivateKey(pwd);
            const restoredPrivateKey = await keyEntryStorage.load(identity);
            expect(restoredPrivateKey!.value).to.equal(privateKey!.value);
        });

        it('has private key', async () => {
            const pwd = 'secret_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            const storage = await createSyncStorage(identity, pwd);
            try {
                storage.retrieveEntry(identity);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            try {
                await sdk.register();
                await sdk.backupPrivateKey(pwd);
            } catch (e) {
                expect(e).to.be.undefined;
            }
            const privateKey = await keyEntryStorage.load(identity);
            expect(privateKey).not.to.be.undefined;
            try {
                await sdk.restorePrivateKey(pwd);
            } catch (e) {
                expect(e).to.be.instanceOf(PrivateKeyAlreadyExistsError);
                return;
            }
            expect.fail();
        });
    });

    describe('encrypt and decrypt', () => {
        it('STE-3 ', async () => {
            const identity1 = uuid();
            const identity2 = uuid();
            const fetchToken1 = () =>
                Promise.resolve(jwtGenerator.generateToken(identity1).toString());
            const fetchToken2 = () =>
                Promise.resolve(jwtGenerator.generateToken(identity2).toString());
            const [sdk1, sdk2] = await Promise.all([
                initializeEThree(fetchToken1),
                initializeEThree(fetchToken2),
            ]);
            await Promise.all([sdk1.register(), sdk2.register()]);
            const message = 'encrypt, decrypt, repeat';
            const sdk1PublicKeys = await sdk1.lookupPublicKeys([identity1]);
            const sdk2PublicKeys = await sdk2.lookupPublicKeys([identity1, identity2]);
            const encryptedMessage = await sdk1.encrypt(message, sdk2PublicKeys);
            try {
                await sdk2.decrypt(encryptedMessage);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
            }
            const decryptedMessage = await sdk2.decrypt(
                encryptedMessage,
                sdk1PublicKeys[identity1],
            );
            expect(decryptedMessage).to.equal(message);
        });

        it('STE-5 encrypt for one public key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            const { publicKey } = virgilCrypto.generateKeys();
            await sdk.register();
            const result = await sdk.encrypt('privet', publicKey);
            expect(typeof result === 'string').to.be.true;
        });

        it('STE-6 encrypt and decrypt without public keys', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const message = 'secret message';
            const encryptedMessage = await sdk.encrypt(message);
            const decryptedMessage = await sdk.decrypt(encryptedMessage);
            expect(decryptedMessage).to.equal(message);
        });

        it('STE-7 decrypt message without sign', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const receiverPublicKey = await sdk.lookupPublicKeys([identity]);
            const { publicKey: senderPublicKey } = virgilCrypto.generateKeys();
            const message = 'encrypted, but not signed :)';
            const encryptedMessage = virgilCrypto
                .encrypt(message, receiverPublicKey[identity] as VirgilPublicKey)
                .toString('base64');
            try {
                await sdk.decrypt(encryptedMessage, senderPublicKey);
            } catch (e) {
                expect(e).not.to.be.undefined;
                return;
            }
            expect.fail();
        });

        it('STE-8 no decrypt/encrypt before register', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            await keyEntryStorage.clear();
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.encrypt('message');
            } catch (e) {
                expect(e).to.be.instanceOf(MissingPrivateKeyError);
            }
            try {
                await sdk.decrypt('message');
            } catch (e) {
                expect(e).to.be.instanceOf(MissingPrivateKeyError);
                return;
            }
            expect.fail();
        });

        it('should return buffer', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const buf = new Uint8Array(32);
            const recipient = virgilCrypto.generateKeys();
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const publicKey = (await sdk.lookupPublicKeys([identity]))[0];
            const encryptedMessage = await sdk.encrypt(buf, recipient.publicKey);
            expect(isBuffer(encryptedMessage)).to.be.true;
            const resp = await sdk.decrypt(encryptedMessage, publicKey);
            expect(isBuffer(resp)).to.be.true;
        });
    });

    describe('cleanup()', () => {
        it('local and remote key exists', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            await sdk.cleanup();
            const privateKeyFromLocalStorage = await keyEntryStorage.load(identity);
            expect(privateKeyFromLocalStorage).to.be.null;
        });
    });

    describe('resetPrivateKeyBackup(pwd?)', () => {
        it('reset backup private key', async () => {
            const pwd = 'secure_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const cloudStorage = await createSyncStorage(identity, pwd);
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(pwd);
            try {
                await sdk.resetPrivateKeyBackup(pwd);
            } catch (e) {
                expect(e).to.be.undefined;
            }
            try {
                cloudStorage.retrieveEntry(identity);
            } catch (e) {
                expect(e).not.to.be.undefined;
                return;
            }
            expect.fail();
        });

        it('reset backup private key when no backup', async () => {
            const pwd = 'secure_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            try {
                await sdk.resetPrivateKeyBackup(pwd);
            } catch (e) {
                expect(e).to.be.instanceOf(PrivateKeyNoBackupError);
                return;
            }
            expect.fail();
        });

        it('reset backup private without password', async () => {
            const pwd = 'secure_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(pwd);
            const cloudStorage = await createSyncStorage(identity, pwd);
            let isExisting = cloudStorage.existsEntry(identity);
            expect(isExisting).to.be.true;
            await sdk.resetPrivateKeyBackup();
            await cloudStorage.retrieveCloudEntries();
            isExisting = cloudStorage.existsEntry(identity);
            expect(isExisting).to.be.false;
        });
    });

    describe('hasPrivateKey()', () => {
        it('has private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const hasPrivateKey = await sdk.hasLocalPrivateKey();
            expect(hasPrivateKey).to.be.true;
        });

        it('has no private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            const hasPrivateKey = await sdk.hasLocalPrivateKey();
            expect(hasPrivateKey).to.be.false;
        });
    });

    describe('unregister()', () => {
        it('STE-20 revokes Virgil Card and deletes private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.unregister();
            } catch (error) {
                expect(error).to.be.instanceOf(RegisterRequiredError);
            }
            await sdk.register();
            await sdk.unregister();
            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards).to.have.length(0);
            expect(key).to.be.null;
        });
    });

    describe('findUsers', () => {
        it('returns single card when given a single identity', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const keypair = virgilCrypto.generateKeys();
            await cardManager.publishCard({ identity, ...keypair });
            const card = await sdk.findUsers(identity);
            expect(card).to.be.ok;
            expect(card.identity).to.eq(identity);
            expect(
                virgilCrypto
                    .exportPublicKey(card.publicKey as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(keypair.publicKey)),
            ).to.be.true;
        });

        it('returns dictionary of cards keyed by identity when given an array of identities', async () => {
            const myIdentity = uuid();
            const fetchToken = createFetchToken(myIdentity);
            const sdk = await initializeEThree(fetchToken);

            const theirIdentity = uuid();
            const theirKeypair = virgilCrypto.generateKeys();
            await cardManager.publishCard({ identity: theirIdentity, ...theirKeypair });
            const result = await sdk.findUsers([theirIdentity]);
            expect(result).to.be.ok;
            expect(result[theirIdentity]).to.be.ok;
            expect(
                virgilCrypto
                    .exportPublicKey(result[theirIdentity].publicKey as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(theirKeypair.publicKey)),
            ).to.be.true;
        });
    });

    describe('authEncrypt -> authDecrypt', () => {
        it('works', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await EThree.initialize(fetchToken, {
                apiUrl: process.env.API_URL,
                groupStorageName: `.virgil-group-storage/${uuid()}`,
                keyPairType: KeyPairType.CURVE25519_ROUND5_ED25519_FALCON,
            });
            await sdk.register();
            const message = 'message';
            const encrypted = await sdk.authEncrypt(message);
            const decrypted = await sdk.authDecrypt(encrypted);
            expect(decrypted).to.equal(message);
        });
    });
});
