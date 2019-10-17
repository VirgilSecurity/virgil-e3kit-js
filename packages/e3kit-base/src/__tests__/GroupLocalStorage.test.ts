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
                epochNumber: i + 1,
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

describe.only('GroupLocalStorage', () => {
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

        it('stores group with tickets', () => {
            const identity = 'test';
            const sessionId = getRandomString('session');
            const storage = new GroupLocalStorage(identity, memdown());
            const rawGroup = {
                info: createGroupInfo(),
                tickets: createTickets(sessionId, 10),
            };
            expect(storage.store(rawGroup)).eventually.equal(undefined);
        });
    });

    // describe('retrieve', () => {

    // });

    // describe('delete', () => {

    // });

    // describe('reset', () => {

    // });
});
