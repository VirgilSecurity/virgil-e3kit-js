import expect from 'expect';
import uuid from 'uuid/v4';
import isBuffer from 'is-buffer';

import { setFoundationModules, VirgilCrypto } from '@virgilsecurity/base-crypto';
import initFoundation from '@virgilsecurity/core-foundation';
import {
    KeyknoxManager,
    KeyknoxClient,
    KeyknoxCrypto,
    CloudKeyStorage,
} from '@virgilsecurity/keyknox';
import { initPythia, VirgilBrainKeyCrypto } from '@virgilsecurity/pythia-crypto';
import { VirgilCardCrypto, VirgilAccessTokenSigner } from '@virgilsecurity/sdk-crypto';
import {
    VirgilCardVerifier,
    JwtGenerator,
    CachingJwtProvider,
    GeneratorJwtProvider,
    CardManager,
    KeyEntryStorage,
} from 'virgil-sdk';

import { getObjectValues } from '../utils/array';
import { generateBrainPair } from '../utils/brainkey';
import {
    IdentityAlreadyExistsError,
    RegisterRequiredError,
    LookupError,
    LookupNotFoundError,
    WrongKeyknoxPasswordError,
    PrivateKeyAlreadyExistsError,
    PrivateKeyNoBackupError,
} from '../errors';
import { DUPLICATE_IDENTITIES, EMPTY_ARRAY } from '../constants';
import { EThree } from '../EThree';
import { VirgilPublicKey, IKeyEntry } from '../externalTypes';

describe('EThree', () => {
    let virgilCrypto: VirgilCrypto;
    let virgilCardCrypto: VirgilCardCrypto;
    let virgilCardVerifier: VirgilCardVerifier;
    let jwtGenerator: JwtGenerator;
    let generatorJwtProvider: GeneratorJwtProvider;
    let cardManager: CardManager;
    let keyEntryStorage: KeyEntryStorage;

    before(async () => {
        await Promise.all([initFoundation().then(setFoundationModules), initPythia()]);
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
            apiKeyId: process.env.API_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
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
        EThree.initialize(fetchToken, { apiUrl: process.env.API_URL });

    const createSyncStorage = async (identity: string, password: string) => {
        const fetchToken = createFetchToken(identity);

        const keyPair = await generateBrainPair(password, {
            virgilCrypto: virgilCrypto,
            pythiaCrypto: new VirgilBrainKeyCrypto(),
            accessTokenProvider: new CachingJwtProvider(fetchToken),
            apiUrl: process.env.API_URL,
        });

        const storage = new CloudKeyStorage(
            new KeyknoxManager(
                new CachingJwtProvider(fetchToken),
                keyPair.privateKey,
                keyPair.publicKey,
                new KeyknoxCrypto(virgilCrypto),
                new KeyknoxClient(process.env.API_URL),
            ),
        );

        await storage.retrieveCloudEntries();
        return storage;
    };

    describe('EThree.register()', () => {
        it('STA-9 has no local key, has no card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const prevCards = await cardManager.searchCards(identity);
            expect(prevCards.length).toBe(0);
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards.length).toBe(1);
            expect(key).not.toBe(null);
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
            expect(cards.length).toEqual(1);
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

            expect(prevCards.length).toEqual(1);

            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.register();
            } catch (e) {
                expect(e).toBeInstanceOf(IdentityAlreadyExistsError);
            }
        });

        it('STE-11 call 2 times', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const prevCards = await cardManager.searchCards(identity);
            expect(prevCards.length).toBe(0);
            const sdk = await initializeEThree(fetchToken);
            const promise = sdk.register();
            try {
                await sdk.register();
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
            }
            await promise;
            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards.length).toBe(1);
            expect(key).not.toBe(null);
        });

        it('STE-44 registers with provided key pair', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const keyPair = sdk.virgilCrypto.generateKeys();
            await sdk.register(keyPair);
            const cards = await cardManager.searchCards(identity);
            expect(cards[0].identity).toBe(identity);
            const keyEntry = await keyEntryStorage.load(identity);
            expect(keyEntry).toBeDefined();
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
            expect(newCards.length).toBe(1);
            expect(newCards[0].previousCardId).toBe(prevCard.id);
        });

        it('STE-12 has no card', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
            const cards = await cardManager.searchCards(identity);
            expect(cards.length).toEqual(0);
            try {
                await sdk.rotatePrivateKey();
            } catch (e) {
                expect(e).toBeInstanceOf(RegisterRequiredError);

                return;
            }
            throw 'should throw';
        });

        it('STE-10 rotate 2 times', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);
            const sdk = await initializeEThree(fetchToken);
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

            expect(Array.isArray(lookupResult)).not.toBeTruthy();
            expect(
                virgilCrypto
                    .exportPublicKey(lookupResult)
                    .equals(virgilCrypto.exportPublicKey(keypair.publicKey)),
            ).toBeTruthy();
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

            expect(getObjectValues(publicKeys).length).toBe(2);
            expect(
                virgilCrypto
                    .exportPublicKey(publicKeys[identity1] as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(keypair1.publicKey)),
            ).toBeTruthy();
            expect(
                virgilCrypto
                    .exportPublicKey(publicKeys[identity2] as VirgilPublicKey)
                    .equals(virgilCrypto.exportPublicKey(keypair2.publicKey)),
            ).toBeTruthy();
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
            const identity = uuid();
            const fetchToken = createFetchToken(identity);

            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.lookupPublicKeys([]);
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect(e.message).toEqual(EMPTY_ARRAY);
                return;
            }
            throw 'should throw';
        });

        it('lookupKeys with duplicate identites', async () => {
            const identity = uuid();
            const fetchToken = createFetchToken(identity);

            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.lookupPublicKeys([identity, identity, 'random']);
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                expect(e.message).toEqual(DUPLICATE_IDENTITIES);
                return;
            }
            throw 'should throw';
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
            expect(hasKey).toEqual(true);
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
                expect(e).toBeInstanceOf(WrongKeyknoxPasswordError);
                return;
            }
            throw 'should throw';
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
                expect(e).toBeInstanceOf(Error);
            }

            try {
                await sdk.register();
                await sdk.backupPrivateKey(pwd);
            } catch (e) {
                expect(e).not.toBeDefined();
            }
            await storage.retrieveCloudEntries();
            const key = storage.retrieveEntry(identity);
            expect(key).not.toBeNull();
        });

        it('No local private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            try {
                await sdk.backupPrivateKey('secret_pass');
            } catch (e) {
                expect(e).toBeInstanceOf(RegisterRequiredError);
                return;
            }
            throw 'should throw';
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
                expect(e).toBeInstanceOf(Error);
            }
            let privateKey: IKeyEntry | null;
            try {
                await sdk.register();
                privateKey = await keyEntryStorage.load(identity);
                await sdk.backupPrivateKey(pwd);
                await sdk.cleanup();
            } catch (e) {
                expect(e).not.toBeDefined();
            }
            const noPrivateKey = await keyEntryStorage.load(identity);
            expect(noPrivateKey).toBeFalsy();
            await sdk.restorePrivateKey(pwd);
            const restoredPrivateKey = await keyEntryStorage.load(identity);
            expect(restoredPrivateKey!.value).toEqual(privateKey!.value);
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
                expect(e).toBeInstanceOf(Error);
            }
            try {
                await sdk.register();
                await sdk.backupPrivateKey(pwd);
            } catch (e) {
                expect(e).not.toBeDefined();
            }

            const noPrivateKey = await keyEntryStorage.load(identity);
            expect(noPrivateKey).toBeTruthy();
            try {
                await sdk.restorePrivateKey(pwd);
            } catch (e) {
                expect(e).toBeInstanceOf(PrivateKeyAlreadyExistsError);

                return;
            }
            throw 'should throw';
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
                expect(e).toBeInstanceOf(Error);
            }
            const decryptedMessage = await sdk2.decrypt(
                encryptedMessage,
                sdk1PublicKeys[identity1],
            );
            expect(decryptedMessage).toEqual(message);
        });

        it('STE-5 encrypt for one public key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());

            const sdk = await initializeEThree(fetchToken);
            const { publicKey } = virgilCrypto.generateKeys();
            await sdk.register();
            try {
                await sdk.encrypt('privet', publicKey);
            } catch (e) {
                expect(e).not.toBeDefined();
            }
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
            expect(decryptedMessage).toEqual(message);
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
                expect(e).toBeDefined();

                return;
            }
            throw 'should throw';
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
                expect(e).toBeInstanceOf(RegisterRequiredError);
            }
            try {
                await sdk.decrypt('message');
            } catch (e) {
                expect(e).toBeInstanceOf(RegisterRequiredError);
            }
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
            expect(isBuffer(encryptedMessage)).toBe(true);

            const resp = await sdk.decrypt(encryptedMessage, publicKey);
            expect(isBuffer(resp)).toBe(true);
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
            expect(privateKeyFromLocalStorage).toEqual(null);
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
                expect(e).not.toBeDefined();
            }

            try {
                cloudStorage.retrieveEntry(identity);
            } catch (e) {
                expect(e).toBeTruthy();
            }
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
                expect(e).toBeInstanceOf(PrivateKeyNoBackupError);

                return;
            }
            throw 'should throw';
        });

        it('reset backup private without password', async () => {
            expect.assertions(2);
            const pwd = 'secure_password';
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            await sdk.register();
            await sdk.backupPrivateKey(pwd);
            const cloudStorage = await createSyncStorage(identity, pwd);
            let isExisting = cloudStorage.existsEntry(identity);
            expect(isExisting).toBe(true);
            await sdk.resetPrivateKeyBackup();
            await cloudStorage.retrieveCloudEntries();
            isExisting = cloudStorage.existsEntry(identity);
            expect(isExisting).toBe(false);
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
            expect(hasPrivateKey).toEqual(true);

            return;
        });

        it('has no private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);
            const hasPrivateKey = await sdk.hasLocalPrivateKey();
            expect(hasPrivateKey).toEqual(false);

            return;
        });
    });

    describe('unregister()', () => {
        it('STE-20 revokes Virgil Card and deletes private key', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const sdk = await initializeEThree(fetchToken);

            await expect(sdk.unregister()).rejects.toBeInstanceOf(RegisterRequiredError);

            await sdk.register();
            await sdk.unregister();

            const [cards, key] = await Promise.all([
                cardManager.searchCards(identity),
                keyEntryStorage.load(identity),
            ]);
            expect(cards).toHaveLength(0);
            expect(key).toBe(null);
        });
    });
});
