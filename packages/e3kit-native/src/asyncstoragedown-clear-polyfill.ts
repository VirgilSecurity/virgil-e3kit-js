import asyncstorageDown from 'asyncstorage-down';

if (typeof asyncstorageDown.prototype.clear === 'undefined') {
    asyncstorageDown.prototype.clear = function (opts?: any, cb?: (err?: Error) => void) {
        let options;
        let callback: (err?: Error) => void;
        if (typeof opts === 'function') {
            options = {};
            callback = opts;
        } else {
            options = opts;
            callback = cb!;
        }

        if (typeof callback !== 'function') {
            throw new Error('clear() requires a callback argument');
        }

        options.reverse = !!options.reverse;
        options.limit = 'limit' in options ? options.limit : -1;
        options.keys = true;
        options.values = false;
        options.keyAsBuffer = false;
        options.valueAsBuffer = false;

        const iterator = this.iterator(options);
        const emptyOptions = {};
        const operations: { type: 'del'; key: string }[] = [];

        const next = (err?: Error) => {
            if (err) {
                return iterator.end(() => {
                    callback(err);
                });
            }

            iterator.next((err: Error | undefined, key: string) => {
                if (err) return next(err);
                if (key === undefined) {
                    this.batch(operations, emptyOptions, (batchErr?: Error) => {
                        iterator.end((endErr?: Error) => {
                            callback(batchErr || endErr);
                        });
                    });
                    return;
                }

                operations.push({ type: 'del', key });
                next();
            });
        };

        next();
    };
}
