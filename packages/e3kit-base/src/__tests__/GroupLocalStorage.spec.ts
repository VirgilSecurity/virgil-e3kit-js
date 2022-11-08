// eslint-disable @typescript-eslint/no-non-null-assertion
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import memdown from 'memdown';
import { VirgilCrypto } from 'virgil-crypto';

import { GroupInfo, Ticket, IKeyPair, ICrypto } from '../types';
import { GroupLocalStorage } from '../GroupLocalStorage';
import { AbstractLevelDOWN } from 'abstract-leveldown';

use(chaiAsPromised);

const getRandomString = (prefix?: string) => {
    return `${prefix ? prefix : ''}${Math.random().toString(36).substr(2)}`;
};

const createGroupInfo = (initiator?: string): GroupInfo => {
    const initiatorName = initiator ? initiator : getRandomString('initiator');
    return { initiator: initiatorName };
};

const createTickets = (sessionId: string, count: number): Ticket[] => {
    const result: Ticket[] = [];
    for (let i = 0; i < count; i++) {
        result.push({
            groupSessionMessage: {
                sessionId,
                epochNumber: i,
                data: getRandomString(),
            },
            participants: [
                getRandomString('participant'),
                getRandomString('participant'),
                getRandomString('participant'),
            ],
        });
    }
    return result;
};

const createKeyPairStub = () => ({ privateKey: {}, publicKey: {} } as IKeyPair);
const createVirgilCryptoStub = () => {
    const virgilCryptoStub = sinon.createStubInstance<ICrypto>(VirgilCrypto);
    virgilCryptoStub.signThenEncrypt.callsFake((value: any, privateKey: any, publicKey: any) => {
        const valueStr = Buffer.isBuffer(value) ? value.toString('utf8') : value;
        return Buffer.from(`encrypted_${valueStr}`);
    });
    virgilCryptoStub.decryptThenVerify.callsFake((value: any, privateKey: any, publicKey: any) => {
        const valueStr = Buffer.isBuffer(value) ? value.toString('utf8') : value;
        return Buffer.from(valueStr.replace(/encrypted_/, ''));
    });
    return virgilCryptoStub;
};

const createGroupLocalStorage = (
    identity: string,
    leveldown: AbstractLevelDOWN = memdown(),
    virgilCrypto: ICrypto = createVirgilCryptoStub(),
    keyPair: IKeyPair = createKeyPairStub(),
) => {
    const storage = new GroupLocalStorage({ identity, leveldown, virgilCrypto });
    storage.setEncryptionKeyPair(keyPair);
    return storage;
};

afterEach(() => {
    sinon.restore();
});

describe('GroupLocalStorage', () => {
    describe('store', () => {
        it('rejects if given a group without tickets', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(),
                tickets: [],
            };
            expect(storage.store(rawGroup)).eventually.rejectedWith(/without tickets/);
        });

        it('stores group with tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            };
            expect(storage.store(rawGroup)).eventually.to.be.undefined;
        });

        it('encrypts the stored group info and tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const virgilCryptoStub = createVirgilCryptoStub();
            const keyPairStub = createKeyPairStub();
            const storage = createGroupLocalStorage(
                identity,
                memdown(),
                virgilCryptoStub,
                keyPairStub,
            );
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };

            await storage.store(rawGroup);

            // must have encrypted the group info and the ticket
            expect(virgilCryptoStub.signThenEncrypt.callCount).to.eq(2);
            expect(virgilCryptoStub.signThenEncrypt.firstCall.args[0]).to.eq(
                JSON.stringify(rawGroup.info),
            );
            expect(virgilCryptoStub.signThenEncrypt.firstCall.args[1]).to.eq(
                keyPairStub.privateKey as any,
            );
            expect(virgilCryptoStub.signThenEncrypt.firstCall.args[2]).to.eq(
                keyPairStub.publicKey as any,
            );

            expect(virgilCryptoStub.signThenEncrypt.secondCall.args[0]).to.eq(
                JSON.stringify(rawGroup.tickets[0]),
            );
            expect(virgilCryptoStub.signThenEncrypt.secondCall.args[1]).to.eq(
                keyPairStub.privateKey as any,
            );
            expect(virgilCryptoStub.signThenEncrypt.secondCall.args[2]).to.eq(
                keyPairStub.publicKey as any,
            );
        });

        it('rejects if encryption fails', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const keyPairStub = createKeyPairStub();
            const virgilCryptoStub = createVirgilCryptoStub();
            virgilCryptoStub.signThenEncrypt.throwsException(new Error('failed to encrypt'));

            const storage = createGroupLocalStorage(
                identity,
                memdown(),
                virgilCryptoStub,
                keyPairStub,
            );
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };

            expect(storage.store(rawGroup)).eventually.to.be.rejectedWith('failed to encrypt');
        });

        it('rejects if encryption key pair is not set', async () => {
            const storage = new GroupLocalStorage({
                identity: 'test',
                leveldown: memdown(),
                virgilCrypto: createVirgilCryptoStub(),
            });
            const sessionId = getRandomString('session');
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };
            expect(storage.store(rawGroup)).eventually.to.be.rejectedWith('Key pair is not set');
        });
    });

    describe('retrieve', () => {
        it('rejects if neither "ticketCount" nor "epochNumber" is provided', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);
            expect(storage.retrieve('some_session', {} as any)).eventually.rejectedWith(
                /(ticketCount)|(epochNumber)/,
            );
        });

        it('rejects if both "ticketCount" and "epochNumber" is provided', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);
            expect(
                storage.retrieve('some_session', { ticketCount: 1, epochNumber: 1 }),
            ).eventually.rejectedWith(/(ticketCount)|(epochNumber)/);
        });

        it('returns null if session does not exist', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);
            expect(storage.retrieve('non-existent', { ticketCount: 20 })).eventually.eq(null);
        });

        it('returns null if session info exists but ticket specified by "epochNumber" does not', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(identity),
                tickets: createTickets(sessionId, 10),
            };
            await storage.store(rawGroup);
            const retrieved = await storage.retrieve(sessionId, { epochNumber: 99 });
            expect(retrieved).to.be.null;
        });

        it('returns session with one ticket when given "epochNumber" option', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(identity),
                tickets: createTickets(sessionId, 100),
            };
            await storage.store(rawGroup);

            const retrieved = await storage.retrieve(sessionId, { epochNumber: 10 });
            expect(retrieved).not.to.be.null;
            expect(retrieved!.info.initiator).to.eq(identity);
            expect(retrieved!.tickets.length).to.eq(1);
            expect(retrieved!.tickets[0].groupSessionMessage.epochNumber).to.eq(10);
            expect(retrieved!.tickets[0].groupSessionMessage.sessionId).to.eq(sessionId);
        });

        it('returns session with latest N tickets when given "ticketCount" option', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(identity),
                tickets: createTickets(sessionId, 100),
            };
            await storage.store(rawGroup);

            const retrieved = await storage.retrieve(sessionId, { ticketCount: 20 });
            expect(retrieved).not.to.be.null;
            expect(retrieved!.info.initiator).to.eq(identity);
            expect(retrieved!.tickets.length).to.eq(20);
            for (let i = 0; i < 20; i++) {
                expect(retrieved!.tickets[i].groupSessionMessage.epochNumber).to.eq(80 + i);
                expect(retrieved!.tickets[i].groupSessionMessage.sessionId).to.eq(sessionId);
            }
        });

        it('returns all tickets if there are fewer than requested', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(identity),
                tickets: createTickets(sessionId, 10),
            };
            await storage.store(rawGroup);
            const retrieved = await storage.retrieve(sessionId, { ticketCount: 20 });
            expect(retrieved).not.to.be.null;
            expect(retrieved!.info.initiator).to.eq(identity);
            expect(retrieved!.tickets.length).to.eq(10);
        });

        it('cannot retrieve groups stored under other identities', async () => {
            const identity1 = getRandomString('identity');
            const identity2 = getRandomString('identity');

            const commonStorageBackend = memdown();
            const storage1 = createGroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = createGroupLocalStorage(identity2, commonStorageBackend);

            const sessionId = getRandomString('session');
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            };

            await storage1.store(rawGroup);

            const group1 = await storage1.retrieve(sessionId, { ticketCount: 10 });
            expect(group1).to.be.ok;

            const group2 = await storage2.retrieve(sessionId, { ticketCount: 10 });
            expect(group2).to.be.null;
        });

        it('decrypts the stored group info and tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const virgilCryptoStub = createVirgilCryptoStub();
            const keyPairStub = createKeyPairStub();
            const storage = createGroupLocalStorage(
                identity,
                memdown(),
                virgilCryptoStub,
                keyPairStub,
            );
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };

            await storage.store(rawGroup);

            await storage.retrieve(sessionId, { ticketCount: 1 });

            // must have decrypted the group info and the ticket
            expect(virgilCryptoStub.decryptThenVerify.callCount).to.eq(2);
            expect(virgilCryptoStub.decryptThenVerify.firstCall.args[0].toString()).to.eq(
                `encrypted_${JSON.stringify(rawGroup.info)}`,
            );
            expect(virgilCryptoStub.decryptThenVerify.firstCall.args[1]).to.eq(
                keyPairStub.privateKey as any,
            );
            expect(virgilCryptoStub.decryptThenVerify.firstCall.args[2]).to.eq(
                keyPairStub.publicKey as any,
            );

            expect(virgilCryptoStub.decryptThenVerify.secondCall.args[0].toString()).to.eq(
                `encrypted_${JSON.stringify(rawGroup.tickets[0])}`,
            );
            expect(virgilCryptoStub.decryptThenVerify.secondCall.args[1]).to.eq(
                keyPairStub.privateKey as any,
            );
            expect(virgilCryptoStub.decryptThenVerify.secondCall.args[2]).to.eq(
                keyPairStub.publicKey as any,
            );
        });

        it('rejects if decryption fails', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const keyPairStub = createKeyPairStub();
            const virgilCryptoStub = createVirgilCryptoStub();
            virgilCryptoStub.decryptThenVerify.throwsException(new Error('failed to decrypt'));

            const storage = createGroupLocalStorage(
                identity,
                memdown(),
                virgilCryptoStub,
                keyPairStub,
            );
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };

            await storage.store(rawGroup);

            expect(storage.retrieve(sessionId, { ticketCount: 1 })).eventually.to.be.rejectedWith(
                'failed to decrypt',
            );
        });

        it('rejects if encryption key pair is not set', async () => {
            const commonStorageBackend = memdown();
            const validStorage = new GroupLocalStorage({
                identity: 'test',
                leveldown: commonStorageBackend,
                virgilCrypto: createVirgilCryptoStub(),
            });
            const invalidStorage = new GroupLocalStorage({
                identity: 'test',
                leveldown: commonStorageBackend,
                virgilCrypto: createVirgilCryptoStub(),
            });
            const sessionId = getRandomString('session');
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 1),
            };
            validStorage.setEncryptionKeyPair(createKeyPairStub());
            await validStorage.store(rawGroup);

            expect(
                invalidStorage.retrieve(sessionId, { ticketCount: 1 }),
            ).eventually.to.be.rejectedWith('Key pair is not set');
        });
    });

    describe('delete', () => {
        it('removes the session and its tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = createGroupLocalStorage(identity);
            const rawGroup = {
                info: createGroupInfo(identity),
                tickets: createTickets(sessionId, 10),
            };
            await storage.store(rawGroup);

            await storage.delete(sessionId);

            const retrieved = await storage.retrieve(sessionId, { ticketCount: 10 });
            expect(retrieved).to.be.null;
        });

        it('does nothing if session does not exist', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);
            expect(storage.delete('non-existend')).eventually.fulfilled;
        });

        it('does not delete groups stored under other identities', async () => {
            const identity1 = getRandomString('identity');
            const identity2 = getRandomString('identity');

            const commonStorageBackend = memdown();
            const storage1 = createGroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = createGroupLocalStorage(identity2, commonStorageBackend);

            const sessionId = getRandomString('session');
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            };

            await storage1.store(rawGroup);
            await storage2.store(rawGroup);

            await storage1.delete(sessionId);

            const group1 = await storage1.retrieve(sessionId, { ticketCount: 10 });
            expect(group1).to.be.null;

            const group2 = await storage2.retrieve(sessionId, { ticketCount: 10 });
            expect(group2).to.be.ok;
        });
    });

    describe('reset', () => {
        it('deletes all sessions', async () => {
            const identity = 'test';
            const storage = createGroupLocalStorage(identity);

            const sessionIds = [];
            for (let i = 0; i < 10; i++) {
                sessionIds.push(getRandomString('session'));
            }

            const groups = sessionIds.map((sessionId) => ({
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            }));

            await Promise.all(groups.map((g) => storage.store(g)));

            await storage.reset();

            for (let i = 0; i < 10; i++) {
                const retrieved = await storage.retrieve(sessionIds[i], { ticketCount: 10 });
                expect(retrieved).to.be.null;
            }
        });

        it('does not clear sessoins stored under other identities', async () => {
            const identity1 = getRandomString('identity');
            const identity2 = getRandomString('identity');

            const commonStorageBackend = memdown();
            const storage1 = createGroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = createGroupLocalStorage(identity2, commonStorageBackend);

            const sessionIds = [];
            for (let i = 0; i < 10; i++) {
                sessionIds.push(getRandomString('session'));
            }

            const groups = sessionIds.map((sessionId) => ({
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            }));

            await Promise.all(
                groups.map((g) => storage1.store(g)).concat(groups.map((g) => storage2.store(g))),
            );

            await storage1.reset();

            const storage1Groups = await Promise.all(
                sessionIds.map((sessionId) => storage1.retrieve(sessionId, { ticketCount: 100 })),
            );

            expect(storage1Groups.every((el) => el == null)).to.be.true;

            const storage2Groups = await Promise.all(
                sessionIds.map((sessionId) => storage2.retrieve(sessionId, { ticketCount: 100 })),
            );

            expect(storage2Groups.every((el) => el != null)).to.be.true;
        });
    });
});
