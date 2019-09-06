import expect from 'expect';
import uuid from 'uuid/v4';

import { setFoundationModules, VirgilCrypto } from '@virgilsecurity/base-crypto';
import initFoundation from '@virgilsecurity/core-foundation';
import { VirgilAccessTokenSigner } from '@virgilsecurity/sdk-crypto';
import { JwtGenerator } from 'virgil-sdk';

import {
    VIRGIL_STREAM_SIGNING_STATE,
    VIRGIL_STREAM_ENCRYPTING_STATE,
    VIRGIL_STREAM_DECRYPTING_STATE,
    VIRGIL_STREAM_VERIFYING_STATE,
} from '../utils/constants';
import { IntegrityCheckFailedError } from '../errors';
import { EThree } from '../EThree';
import { LookupResult, onEncryptProgressSnapshot, onDecryptProgressSnapshot } from '../types';

import './EThree.test';

describe('EThree', () => {
    let virgilCrypto: VirgilCrypto;
    let jwtGenerator: JwtGenerator;

    before(async () => {
        await initFoundation().then(setFoundationModules);
    });

    beforeEach(async () => {
        virgilCrypto = new VirgilCrypto();
        jwtGenerator = new JwtGenerator({
            appId: process.env.APP_ID!,
            apiKeyId: process.env.API_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.API_KEY!),
            accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
        });
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

            expect(originString).toEqual(decryptedString);
        });

        it('should encrypt for multiple keys', async () => {
            const onlyTwoKeys = await sdk1.lookupPublicKeys([identity1, identity2]);
            const encryptedFile = await sdk1.encryptFile(originFile, onlyTwoKeys);
            const decryptedFile = await sdk2.decryptFile(encryptedFile, onlyTwoKeys[identity1]);

            const decryptedString = await readFile(decryptedFile);

            expect(originString).toBe(decryptedString);

            try {
                await sdk3.decryptFile(encryptedFile, onlyTwoKeys[identity1]);
            } catch (e) {
                return expect(e).toBeInstanceOf(Error);
            }

            throw new Error('should throw');
        });

        it('should take input as string, file or blob', async () => {
            const keypair = virgilCrypto.generateKeys();

            const originBlob = new Blob(['foo'], {
                type: 'text/plain',
            });

            const encryptedFile = await sdk1.encryptFile(originFile, keypair.publicKey);
            const encryptedBlob = await sdk1.encryptFile(originBlob, keypair.publicKey);

            expect(encryptedFile).toBeInstanceOf(File);
            expect(encryptedBlob).toBeInstanceOf(Blob);
            expect(encryptedBlob).not.toBeInstanceOf(File);
        });

        it('should process different chunks of data', async () => {
            const encryptedSnapshots: onEncryptProgressSnapshot[] = [];

            const originString = 'foo';

            const originFile = new File([originString], 'foo.txt', {
                type: 'text/plain',
            });

            expect(originFile.size).toBe(3);

            const encryptedFile = await sdk1.encryptFile(originFile, lookupResult[identity2], {
                chunkSize: 2,
                onProgress: encryptedSnapshots.push.bind(encryptedSnapshots),
            });

            expect(encryptedSnapshots.length).toEqual(4);
            expect(encryptedSnapshots[0]).toMatchObject({
                fileSize: originFile.size,
                bytesProcessed: 2,
                state: VIRGIL_STREAM_SIGNING_STATE,
            });
            expect(encryptedSnapshots[1]).toMatchObject({
                fileSize: originFile.size,
                bytesProcessed: 3,
                state: VIRGIL_STREAM_SIGNING_STATE,
            });
            expect(encryptedSnapshots[2]).toMatchObject({
                fileSize: originFile.size,
                bytesProcessed: 2,
                state: VIRGIL_STREAM_ENCRYPTING_STATE,
            });
            expect(encryptedSnapshots[3]).toMatchObject({
                fileSize: originFile.size,
                bytesProcessed: 3,
                state: VIRGIL_STREAM_ENCRYPTING_STATE,
            });

            const decryptedSnapshots: onDecryptProgressSnapshot[] = [];

            await sdk2.decryptFile(encryptedFile, lookupResult[identity1], {
                chunkSize: Math.ceil(encryptedFile.size / 2),
                onProgress: decryptedSnapshots.push.bind(decryptedSnapshots),
            });

            expect(decryptedSnapshots.length).toEqual(3);
            expect(decryptedSnapshots[0]).toMatchObject({
                fileSize: encryptedFile.size,
                bytesProcessed: Math.ceil(encryptedFile.size / 2),
                state: VIRGIL_STREAM_DECRYPTING_STATE,
            });
            expect(decryptedSnapshots[1]).toMatchObject({
                fileSize: encryptedFile.size,
                bytesProcessed: encryptedFile.size,
                state: VIRGIL_STREAM_DECRYPTING_STATE,
            });
            expect(decryptedSnapshots[2]).toMatchObject({
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
                expect(err).toBeInstanceOf(Error);
            }
            try {
                await sdk1.decryptFile(await encryptPromise, lookupResult[identity1], {
                    chunkSize: Math.floor(originFile.size / 3),
                    signal: decryptAbort.signal,
                    onProgress: decryptAbort.abort,
                });
            } catch (err) {
                expect(err).toBeInstanceOf(Error);
                return;
            }

            throw new Error('should throw');
        });

        it('should verify the signature', async () => {
            const receiverPublicKey = await sdk1.lookupPublicKeys(identity2);
            const encryptedFile = await sdk1.encryptFile(originFile, receiverPublicKey);
            try {
                await sdk2.decryptFile(encryptedFile);
            } catch (err) {
                expect(err).toBeInstanceOf(IntegrityCheckFailedError);
                return;
            }
            throw new Error('should throw');
        });
    });
});
