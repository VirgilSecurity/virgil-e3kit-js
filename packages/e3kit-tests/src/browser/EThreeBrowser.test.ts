import { expect } from 'chai';
import uuid from 'uuid/v4';

import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
    IntegrityCheckFailedError,
    LookupResult,
    onEncryptProgressSnapshot,
    onDecryptProgressSnapshot,
    EThree,
    FindUsersResult,
    onProgressSnapshot,
} from '@virgilsecurity/e3kit-browser';
import { initPythia } from '@virgilsecurity/pythia-crypto';
import {
    initCrypto,
    VirgilAccessTokenSigner,
    VirgilCrypto,
    VirgilCryptoError,
    VirgilCryptoErrorStatus,
} from 'virgil-crypto';
import { JwtGenerator, KeyEntryStorage } from 'virgil-sdk';
import compatibilityData from '../common/compatibility_data.json';
import { b64toBlob } from '../common/utils';

describe('EThreeBrowser', () => {
    let virgilCrypto: VirgilCrypto;
    let jwtGenerator: JwtGenerator;
    let keyEntryStorage: KeyEntryStorage;

    before(async () => {
        await Promise.all([initCrypto(), initPythia()]);
        virgilCrypto = new VirgilCrypto();
        jwtGenerator = new JwtGenerator({
            appId: process.env.APP_ID!,
            apiKeyId: process.env.APP_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.APP_KEY!),
            accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
        });
        keyEntryStorage = new KeyEntryStorage('.virgil-local-storage');
    });

    const createFetchToken = (identity: string) => () =>
        Promise.resolve(jwtGenerator.generateToken(identity).toString());

    const initializeETheeFromIdentity = (identity: string) =>
        EThree.initialize(createFetchToken(identity), { apiUrl: process.env.API_URL });

    const readFile = (file: Blob) => {
        const reader = new FileReader();
        const promise = new Promise(r =>
            reader.addEventListener('loadend', () => r(reader.result!)),
        );
        reader.readAsText(file);
        return promise;
    };

    describe('EThree.encryptFile/EThree.decryptFile', async () => {
        const identity1 = uuid();
        const identity2 = uuid();
        const identity3 = uuid();

        let sdk1: EThree, sdk2: EThree, sdk3: EThree, lookupResult: LookupResult;

        const originString = 'foo'.repeat(1024 * 3);

        const originFile = new File([originString], 'foo.txt', {
            type: 'text/plain',
        });

        before(async () => {
            [sdk1, sdk2, sdk3] = await Promise.all([
                initializeETheeFromIdentity(identity1),
                initializeETheeFromIdentity(identity2),
                initializeETheeFromIdentity(identity3),
            ]);
            await Promise.all([sdk1.register(), sdk2.register(), sdk3.register()]);
            lookupResult = await sdk1.lookupPublicKeys([identity1, identity2, identity3]);
        });

        it('should decrypt file for one public key', async () => {
            const [publicKey2, publicKey1] = await Promise.all([
                sdk1.lookupPublicKeys(identity2),
                sdk2.lookupPublicKeys(identity1),
            ]);
            const encryptedFile = await sdk1.encryptFile(originFile, publicKey2);
            const decryptedFile = await sdk2.decryptFile(encryptedFile, publicKey1);
            const decryptedString = await readFile(decryptedFile);
            expect(originString).to.equal(decryptedString);
        });

        it('should encrypt for multiple keys', async () => {
            const onlyTwoKeys = await sdk1.lookupPublicKeys([identity1, identity2]);
            const encryptedFile = await sdk1.encryptFile(originFile, onlyTwoKeys);
            const decryptedFile = await sdk2.decryptFile(encryptedFile, onlyTwoKeys[identity1]);
            const decryptedString = await readFile(decryptedFile);
            expect(originString).to.equal(decryptedString);
            try {
                await sdk3.decryptFile(encryptedFile, onlyTwoKeys[identity1]);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });

        it('should take input as string, file or blob', async () => {
            const keypair = virgilCrypto.generateKeys();
            const originBlob = new Blob(['foo'], {
                type: 'text/plain',
            });
            const encryptedFile = await sdk1.encryptFile(originFile, keypair.publicKey);
            const encryptedBlob = await sdk1.encryptFile(originBlob, keypair.publicKey);
            expect(encryptedFile).to.be.instanceOf(File);
            expect(encryptedBlob).to.be.instanceOf(Blob);
            expect(encryptedBlob).not.to.be.instanceOf(File);
        });

        it('should process different chunks of data', async () => {
            const encryptedSnapshots: onEncryptProgressSnapshot[] = [];
            const originString = 'foo';
            const originFile = new File([originString], 'foo.txt', {
                type: 'text/plain',
            });
            expect(originFile.size).to.equal(3);
            const encryptedFile = await sdk1.encryptFile(originFile, lookupResult[identity2], {
                chunkSize: 2,
                onProgress: encryptedSnapshots.push.bind(encryptedSnapshots),
            });
            expect(encryptedSnapshots).to.have.length(4);
            expect(encryptedSnapshots[0]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 2,
                state: VIRGIL_STREAM_SIGNING_STATE,
            });
            expect(encryptedSnapshots[1]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 3,
                state: VIRGIL_STREAM_SIGNING_STATE,
            });
            expect(encryptedSnapshots[2]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 2,
                state: VIRGIL_STREAM_ENCRYPTING_STATE,
            });
            expect(encryptedSnapshots[3]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 3,
                state: VIRGIL_STREAM_ENCRYPTING_STATE,
            });
            const decryptedSnapshots: onDecryptProgressSnapshot[] = [];
            await sdk2.decryptFile(encryptedFile, lookupResult[identity1], {
                chunkSize: Math.ceil(encryptedFile.size / 2),
                onProgress: decryptedSnapshots.push.bind(decryptedSnapshots),
            });
            expect(decryptedSnapshots).to.have.length(3);
            expect(decryptedSnapshots[0]).to.eql({
                fileSize: encryptedFile.size,
                bytesProcessed: Math.ceil(encryptedFile.size / 2),
                state: VIRGIL_STREAM_DECRYPTING_STATE,
            });
            expect(decryptedSnapshots[1]).to.eql({
                fileSize: encryptedFile.size,
                bytesProcessed: encryptedFile.size,
                state: VIRGIL_STREAM_DECRYPTING_STATE,
            });
            expect(decryptedSnapshots[2]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: originFile.size,
                state: VIRGIL_STREAM_VERIFYING_STATE,
            });
        });

        it('should abort encryptFile', async () => {
            const encryptAbort = new AbortController();
            const decryptAbort = new AbortController();
            const encryptPromise = sdk1.encryptFile(originFile, lookupResult[identity2]);
            const encryptAbortedPromise = sdk1.encryptFile(originFile, lookupResult[identity2], {
                chunkSize: 1,
                signal: encryptAbort.signal,
            });
            encryptAbort.abort();
            try {
                await encryptAbortedPromise;
            } catch (err) {
                expect(err).to.be.instanceOf(Error);
            }
            try {
                await sdk1.decryptFile(await encryptPromise, lookupResult[identity1], {
                    chunkSize: Math.floor(originFile.size / 3),
                    signal: decryptAbort.signal,
                    onProgress: decryptAbort.abort,
                });
            } catch (err) {
                expect(err).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });

        it('should verify the signature', async () => {
            const receiverPublicKey = await sdk1.lookupPublicKeys(identity2);
            const encryptedFile = await sdk1.encryptFile(originFile, receiverPublicKey);
            try {
                await sdk2.decryptFile(encryptedFile);
            } catch (err) {
                expect(err).to.be.instanceOf(IntegrityCheckFailedError);
                return;
            }
            expect.fail();
        });
    });

    describe('EThree.authEncryptFile/EThree.authDecryptFile', async () => {
        const identity1 = uuid();
        const identity2 = uuid();
        const identity3 = uuid();

        let sdk1: EThree, sdk2: EThree, sdk3: EThree, cards: FindUsersResult;

        const originString = 'All work and no pay makes Alexey a dull boy\n'.repeat(128);

        const originFile = new File([originString], 'foo.txt', {
            type: 'text/plain',
        });

        before(async () => {
            [sdk1, sdk2, sdk3] = await Promise.all([
                initializeETheeFromIdentity(identity1),
                initializeETheeFromIdentity(identity2),
                initializeETheeFromIdentity(identity3),
            ]);
            await Promise.all([sdk1.register(), sdk2.register(), sdk3.register()]);
            cards = await sdk1.findUsers([identity1, identity2, identity3]);
        });

        it('should decrypt file for one public key', async () => {
            const [publicKey2, publicKey1] = await Promise.all([
                sdk1.lookupPublicKeys(identity2),
                sdk2.lookupPublicKeys(identity1),
            ]);
            const encryptedFile = await sdk1.authEncryptFile(originFile, publicKey2);
            const decryptedFile = await sdk2.authDecryptFile(encryptedFile, publicKey1);
            const decryptedString = await readFile(decryptedFile);
            expect(originString).to.equal(decryptedString);
        });

        it('should encrypt for multiple keys', async () => {
            const onlyTwoKeys = await sdk1.lookupPublicKeys([identity1, identity2]);
            const encryptedFile = await sdk1.authEncryptFile(originFile, onlyTwoKeys);
            const decryptedFile = await sdk2.authDecryptFile(encryptedFile, onlyTwoKeys[identity1]);
            const decryptedString = await readFile(decryptedFile);
            expect(originString).to.equal(decryptedString);
            try {
                await sdk3.authDecryptFile(encryptedFile, onlyTwoKeys[identity1]);
            } catch (e) {
                expect(e).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });

        it('should take input as string, file or blob', async () => {
            const keypair = virgilCrypto.generateKeys();
            const originBlob = new Blob(['foo'], {
                type: 'text/plain',
            });
            const encryptedFile = await sdk1.authEncryptFile(originFile, keypair.publicKey);
            const encryptedBlob = await sdk1.authEncryptFile(originBlob, keypair.publicKey);
            expect(encryptedFile).to.be.instanceOf(File);
            expect(encryptedBlob).to.be.instanceOf(Blob);
            expect(encryptedBlob).not.to.be.instanceOf(File);
        });

        it('should process different chunks of data', async () => {
            const encryptedSnapshots: onProgressSnapshot[] = [];
            const originString = 'foo';
            const originFile = new File([originString], 'foo.txt', {
                type: 'text/plain',
            });
            expect(originFile.size).to.equal(3);
            const encryptedFile = await sdk1.authEncryptFile(originFile, cards[identity2], {
                chunkSize: 2,
                onProgress: encryptedSnapshots.push.bind(encryptedSnapshots),
            });
            expect(encryptedSnapshots).to.have.length(2);
            expect(encryptedSnapshots[0]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 2,
            });
            expect(encryptedSnapshots[1]).to.eql({
                fileSize: originFile.size,
                bytesProcessed: 3,
            });

            const decryptedSnapshots: onProgressSnapshot[] = [];
            await sdk2.authDecryptFile(encryptedFile, cards[identity1], {
                chunkSize: Math.ceil(encryptedFile.size / 2),
                onProgress: decryptedSnapshots.push.bind(decryptedSnapshots),
            });
            expect(decryptedSnapshots).to.have.length(2);
            expect(decryptedSnapshots[0]).to.eql({
                fileSize: encryptedFile.size,
                bytesProcessed: Math.ceil(encryptedFile.size / 2),
            });
            expect(decryptedSnapshots[1]).to.eql({
                fileSize: encryptedFile.size,
                bytesProcessed: encryptedFile.size,
            });
        });

        it('should abort authEncryptFile', async () => {
            const encryptAbort = new AbortController();
            const decryptAbort = new AbortController();
            const encryptPromise = sdk1.authEncryptFile(originFile, cards[identity2]);
            const encryptAbortedPromise = sdk1.authEncryptFile(originFile, cards[identity2], {
                chunkSize: 1,
                signal: encryptAbort.signal,
            });
            encryptAbort.abort();
            try {
                await encryptAbortedPromise;
            } catch (err) {
                expect(err).to.be.instanceOf(Error);
            }
            try {
                await sdk1.authDecryptFile(await encryptPromise, cards[identity1], {
                    chunkSize: Math.floor(originFile.size / 3),
                    signal: decryptAbort.signal,
                    onProgress: decryptAbort.abort,
                });
            } catch (err) {
                expect(err).to.be.instanceOf(Error);
                return;
            }
            expect.fail();
        });

        it('should verify the signature', async () => {
            const receiverPublicKey = await sdk1.lookupPublicKeys(identity2);
            const encryptedFile = await sdk1.authEncryptFile(originFile, receiverPublicKey);
            try {
                await sdk2.authDecryptFile(encryptedFile);
            } catch (err) {
                expect(err).to.be.instanceOf(VirgilCryptoError);
                expect(err.status).to.be.equal(VirgilCryptoErrorStatus.SIGNER_NOT_FOUND);
                return;
            }
            expect.fail();
        });

        it('compatibility test', async () => {
            const identity = uuid();
            const e3kit = await initializeETheeFromIdentity(identity);
            await keyEntryStorage.save({
                name: identity,
                value: compatibilityData.authEncryptFile.privateKey,
            });
            const encryptedFile = b64toBlob(compatibilityData.authEncryptFile.data, 'foo.txt');
            const decryptedFile = await e3kit.authDecryptFile(encryptedFile);
            const decryptedString = await readFile(decryptedFile);
            expect(originString).to.equal(decryptedString);
        });
    });
});
