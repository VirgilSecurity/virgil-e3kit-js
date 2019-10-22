// eslint-disable @typescript-eslint/no-explicit-any
import {
    AbstractLevelDOWN,
    AbstractIterator,
    AbstractOpenOptions,
    ErrorCallback,
    AbstractGetOptions,
    ErrorValueCallback,
    AbstractOptions,
    AbstractBatch,
    AbstractIteratorOptions,
    ErrorKeyValueCallback,
} from 'abstract-leveldown';
import { ICrypto, IKeyPair } from '../types';

export interface VirgilEncryptDownOptions {
    virgilCrypto: ICrypto;
    keyPair: IKeyPair;
}

class VirgilEncryptDownIterator extends AbstractIterator {
    options: AbstractIteratorOptions;
    it: AbstractIterator<string, Buffer>;

    constructor(db: VirgilEncryptDown, options: AbstractIteratorOptions) {
        super(db);
        this.options = options;
        this.it = db.db.iterator({ ...options, valueAsBuffer: true });
    }

    _next(callback: ErrorKeyValueCallback<string, string | Buffer>) {
        this.it.next((err, key, encrypted) => {
            if (err) {
                return callback(err, undefined!, undefined!);
            }

            if (key === undefined && encrypted === undefined) {
                return callback(undefined, undefined!, undefined!);
            }

            try {
                const decrypted = this.db.decrypt(encrypted);
                callback(
                    undefined,
                    key,
                    this.options.valueAsBuffer ? decrypted : decrypted.toString('utf8'),
                );
            } catch (err) {
                callback(err, undefined!, undefined!);
            }
        });
    }

    _end(callback: ErrorCallback) {
        this.it.end(callback);
    }
}

class VirgilEncryptDown extends AbstractLevelDOWN {
    db: AbstractLevelDOWN;
    crypto: ICrypto;
    keyPair: IKeyPair;

    constructor(db: AbstractLevelDOWN, options: VirgilEncryptDownOptions) {
        super('ignored');
        this.db = db;
        this.crypto = options.virgilCrypto;
        this.keyPair = options.keyPair;
    }

    _open(options: AbstractOpenOptions, callback: ErrorCallback) {
        this.db.open(options, callback);
    }

    _close(callback: ErrorCallback) {
        this.db.close(callback);
    }

    _get(key: string, options: AbstractGetOptions, callback: ErrorValueCallback<any>) {
        this.db.get(key, { ...options, asBuffer: true }, (err, encrypted) => {
            if (err) {
                return callback(err, undefined);
            }

            try {
                const decrypted = this.decrypt(encrypted);
                callback(undefined, options.asBuffer ? decrypted : decrypted.toString('utf8'));
            } catch (error) {
                callback(error, undefined);
            }
        });
    }

    _put(key: string, value: any, options: AbstractOptions, callback: ErrorCallback) {
        let encrypted;
        try {
            encrypted = this.encrypt(value);
        } catch (err) {
            return setTimeout(() => callback(err));
        }

        this._db.put(key, encrypted, options, callback);
    }

    _del(key: string, options: AbstractOptions, callback: ErrorCallback) {
        this.db.del(key, options, callback);
    }

    _batch(ops: ReadonlyArray<AbstractBatch>, options: AbstractOptions, callback: ErrorCallback) {
        let operations;
        try {
            operations = ops.map(op => {
                if (op.type === 'put') {
                    return { ...op, value: this.encrypt(op.value) };
                }
                return op;
            });
        } catch (err) {
            return setTimeout(() => callback(err));
        }

        this.db.batch(operations, options, callback);
    }

    _clear(options: AbstractOptions, callback: ErrorCallback) {
        this.db.clear(options, callback);
    }

    _iterator(options: AbstractIteratorOptions) {
        return new VirgilEncryptDownIterator(this, options);
    }

    encrypt(value: any) {
        return this.crypto.signThenEncrypt(value, this.keyPair.privateKey, this.keyPair.publicKey);
    }

    decrypt(encryptedValue: any) {
        return this.crypto.decryptThenVerify(
            encryptedValue,
            this.keyPair.privateKey,
            this.keyPair.publicKey,
        );
    }
}

export default VirgilEncryptDown;
