// eslint-disable @typescript-eslint/no-non-null-assertion
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import memdown from 'memdown';
import { GroupInfo, Ticket } from '../types';
import { GroupLocalStorage } from '../GroupLocalStorage';

use(chaiAsPromised);

const getRandomString = (prefix?: string) => {
    return `${prefix ? prefix : ''}${Math.random()
        .toString(36)
        .substr(2)}`;
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

describe('GroupLocalStorage', () => {
    describe('store', () => {
        it('rejects if given a group without tickets', async () => {
            const identity = 'test';
            const storage = new GroupLocalStorage(identity, memdown());
            const rawGroup = {
                info: createGroupInfo(),
                tickets: [],
            };
            expect(storage.store(rawGroup)).eventually.rejectedWith(/without tickets/);
        });

        it('stores group with tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = new GroupLocalStorage(identity, memdown());
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            };
            expect(storage.store(rawGroup)).eventually.to.be.undefined;
        });
    });

    describe('retrieve', () => {
        it('rejects if neither "ticketCount" nor "epochNumber" is provided', async () => {
            const identity = 'test';
            const storage = new GroupLocalStorage(identity, memdown());
            expect(storage.retrieve('some_session', {} as any)).eventually.rejectedWith(
                /(ticketCount)|(epochNumber)/,
            );
        });

        it('rejects if both "ticketCount" and "epochNumber" is provided', async () => {
            const identity = 'test';
            const storage = new GroupLocalStorage(identity, memdown());
            expect(
                storage.retrieve('some_session', { ticketCount: 1, epochNumber: 1 }),
            ).eventually.rejectedWith(/(ticketCount)|(epochNumber)/);
        });

        it('returns null if session does not exist', async () => {
            const identity = 'test';
            const storage = new GroupLocalStorage(identity, memdown());
            expect(storage.retrieve('non-existent', { ticketCount: 20 })).eventually.eq(null);
        });

        it('returns null if session info exists but ticket specified by "epochNumber" does not', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = new GroupLocalStorage(identity, memdown());
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
            const storage = new GroupLocalStorage(identity, memdown());
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
            const storage = new GroupLocalStorage(identity, memdown());
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
            const storage = new GroupLocalStorage(identity, memdown());
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
            const storage1 = new GroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = new GroupLocalStorage(identity2, commonStorageBackend);

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
    });

    describe('delete', () => {
        it('removes the session and its tickets', async () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = new GroupLocalStorage(identity, memdown());
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
            const storage = new GroupLocalStorage(identity, memdown());
            expect(storage.delete('non-existend')).eventually.fulfilled;
        });

        it('does not delete groups stored under other identities', async () => {
            const identity1 = getRandomString('identity');
            const identity2 = getRandomString('identity');

            const commonStorageBackend = memdown();
            const storage1 = new GroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = new GroupLocalStorage(identity2, commonStorageBackend);

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
            const storage = new GroupLocalStorage(identity, memdown());

            const sessionIds = [];
            for (let i = 0; i < 10; i++) {
                sessionIds.push(getRandomString('session'));
            }

            const groups = sessionIds.map(sessionId => ({
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            }));

            await Promise.all(groups.map(g => storage.store(g)));

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
            const storage1 = new GroupLocalStorage(identity1, commonStorageBackend);
            const storage2 = new GroupLocalStorage(identity2, commonStorageBackend);

            const sessionIds = [];
            for (let i = 0; i < 10; i++) {
                sessionIds.push(getRandomString('session'));
            }

            const groups = sessionIds.map(sessionId => ({
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            }));

            await Promise.all(
                groups.map(g => storage1.store(g)).concat(groups.map(g => storage2.store(g))),
            );

            await storage1.reset();

            const storage1Groups = await Promise.all(
                sessionIds.map(sessionId => storage1.retrieve(sessionId, { ticketCount: 100 })),
            );

            expect(storage1Groups.every(el => el == null)).to.be.true;

            const storage2Groups = await Promise.all(
                sessionIds.map(sessionId => storage2.retrieve(sessionId, { ticketCount: 100 })),
            );

            expect(storage2Groups.every(el => el != null)).to.be.true;
        });
    });
});
