type promiseFunc<T> = (...args: any[]) => Promise<T>;

export function queueWithThrottling<T>(func: promiseFunc<T>, time: number) {
    const createTimer = () => new Promise(resolve => setTimeout(resolve, time));
    let currentWaiter: Promise<{}> = Promise.resolve({});

    return function(...args: any) {
        let action: any;
        let newWaiter = new Promise((resolve, reject) => {
            action = () => {
                let result: T;
                return func(args)
                    .then((res: T) => (result = res))
                    .then(() => createTimer())
                    .then(resolve)
                    .then(() => result)
                    .catch(reject);
            };
        });
        const res = currentWaiter.then(action as promiseFunc<T>);
        currentWaiter = newWaiter;
        return res;
    };
}
