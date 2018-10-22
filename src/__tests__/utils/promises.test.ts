import { queueWithThrottling } from '../../utils/promises';

jest.useRealTimers();

describe('should run promises in interval', () => {
    it('should call second promise after 2 seconds', async done => {
        let count = 0;
        const func = jest.fn(() => {
            const res = Promise.resolve(++count);
            return res;
        });

        const throttledFunc = queueWithThrottling<number>(func, 2000);
        Promise.all([
            throttledFunc().then(res => expect(res).toBe(1)),
            throttledFunc().then(res => expect(res).toBe(2)),
            throttledFunc().then(res => expect(res).toBe(3)),
        ]);
        setTimeout(() => {
            expect(func).toBeCalledTimes(1);
        }, 2000);
        setTimeout(() => {
            expect(func).toBeCalledTimes(2);
        }, 4000);
        setTimeout(() => {
            expect(func).toBeCalledTimes(3);
            done();
        }, 6000);
    });
});
