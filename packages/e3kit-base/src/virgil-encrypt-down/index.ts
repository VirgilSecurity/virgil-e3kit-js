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
    keyPair?: IKeyPair;
}

export type ValueType = string | Buffer;

class VirgilEncryptDownIterator<K> extends AbstractIterator<K, ValueType> {
    options: AbstractIteratorOptions;
    it: AbstractIterator<K, Buffer>;

    constructor(db: VirgilEncryptDown<K>, options: AbstractIteratorOptions) {
        super(db);
        this.options = options;
        this.it = db.db.iterator({ ...options, valueAsBuffer: true });
    }

    _next(callback: ErrorKeyValueCallback<K, ValueType>) {
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
            } catch (err: any) {
                callback(err, undefined!, undefined!);
            }
        });
    }

    _end(callback: ErrorCallback) {
        this.it.end(callback);
    }
}

class VirgilEncryptDown<K> extends AbstractLevelDOWN<K, ValueType> {
    public db: AbstractLevelDOWN;
    crypto: ICrypto;
    keyPair?: IKeyPair;

    constructor(db: AbstractLevelDOWN<K, ValueType>, options: VirgilEncryptDownOptions) {
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

    _get(key: K, options: AbstractGetOptions, callback: ErrorValueCallback<ValueType>) {
        this.db.get(key, { ...options, asBuffer: true }, (err, encrypted) => {
            if (err) {
                return callback(err, undefined!);
            }

            try {
                const decrypted = this.decrypt(encrypted);
                callback(undefined, options.asBuffer ? decrypted : decrypted.toString('utf8'));
            } catch (error: any) {
                callback(error, undefined!);
            }
        });
    }

    _put(key: K, value: ValueType, options: AbstractOptions, callback: ErrorCallback) {
        let encrypted;
        try {
            encrypted = this.encrypt(value);
        } catch (err: any) {
            return setTimeout(() => callback(err));
        }

        this._db.put(key, encrypted, options, callback);
    }

    _del(key: K, options: AbstractOptions, callback: ErrorCallback) {
        this.db.del(key, options, callback);
    }

    _batch(
        ops: ReadonlyArray<AbstractBatch<K, ValueType>>,
        options: AbstractOptions,
        callback: ErrorCallback,
    ) {
        let operations;
        try {
            operations = ops.map((op) => {
                if (op.type === 'put') {
                    return { ...op, value: this.encrypt(op.value) };
                }
                return op;
            });
        } catch (err: any) {
            return setTimeout(() => callback(err));
        }

        this.db.batch(operations, options, callback);
    }

    _clear(options: AbstractOptions, callback: ErrorCallback) {
        this.db.clear(options, callback);
    }

    _iterator(options: AbstractIteratorOptions<K>) {
        return new VirgilEncryptDownIterator<K>(this, options);
    }

    setKeyPair(keyPair: IKeyPair) {
        this.keyPair = keyPair;
    }

    encrypt(value: ValueType) {
        if (!this.keyPair) {
            throw new Error('Cannot encrypt value. Key pair is not set. Call "setKeyPair" first.');
        }
        return this.crypto.signThenEncrypt(value, this.keyPair.privateKey, this.keyPair.publicKey);
    }

    decrypt(encryptedValue: ValueType) {
        if (!this.keyPair) {
            throw new Error('Cannot decrypt value. Key pair is not set. Call "setKeyPair" first.');
        }
        return this.crypto.decryptThenVerify(
            encryptedValue,
            this.keyPair.privateKey,
            this.keyPair.publicKey,
        );
    }
}

export default VirgilEncryptDown;
