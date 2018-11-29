import { VirgilPublicKey } from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';

export class SdkError extends Error {
    name: string;
    constructor(m: string, name: string = 'SdkError') {
        super(m);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = name;
    }
}

export class IdentityAlreadyExistsError extends SdkError {
    constructor() {
        super(
            'This identity already registered on Virgil Cloud. To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey',
            'IdentityAlreadyExistsError',
        );
    }
}

export class PrivateKeyNotFoundError extends SdkError {
    constructor() {
        super('Private key not found', 'PrivateKeyNotFoundError');
    }
}

export class RegisterRequiredError extends SdkError {
    constructor() {
        super('This identity is not registered', 'RegisterRequiredError');
    }
}

export class WrongKeyknoxPasswordError extends SdkError {
    constructor() {
        super('Password from remote private key storage is invalid', 'WrongKeyknoxPasswordError');
    }
}

export class EmptyArrayError extends SdkError {
    constructor(method: string) {
        super(`Array must be non empty in ${method} method`);
    }
}

export class MultithreadError extends SdkError {
    constructor(method: string) {
        super(`${method} method was called two or more times in a row.`);
    }
}

export class PrivateKeyAlreadyExistsError extends SdkError {
    constructor() {
        super(
            'You already have a private key. Use EThree.cleanup() to delete it. If you delete last copy of private key, you will not able to decrypt any information encrypted for this private key',
            'PrivateKeyAlreadyExistsError',
        );
    }
}

export class PrivateKeyNoBackupError extends SdkError {
    constructor() {
        super("Backup private key doesn't exist", 'PrivateKeyNoBackupError');
    }
}

export class MultipleCardsError extends SdkError {
    constructor(identity: string) {
        super(
            `There are several public keys registered with ${identity}, which is not supported.`,
            'MultipleCardsError',
        );
    }
}

const isError = (arg: any): arg is Error => arg instanceof Error;
const isPublicKey = (arg: any): arg is VirgilPublicKey => !(arg instanceof Error);

export class LookupError extends SdkError {
    result: Array<VirgilPublicKey | Error>;

    rejected(): Error[] {
        return this.result.filter(isError);
    }
    resolved(): VirgilPublicKey[] {
        return this.result.filter(isPublicKey);
    }

    constructor(result: Array<VirgilPublicKey | Error>) {
        super(
            `Failed some public keys lookups. You can see the results by error.resolved() and error.rejected() methods of this error instance`,
            'LookupError',
        );
        this.result = result;
        console.error(
            this.rejected()
                .map(error => (error.message ? error.message : error))
                .join('\n'),
        );
    }
}

export class LookupNotFoundError extends SdkError {
    constructor(public identity: string) {
        super(`${identity} not found`, 'LookupNotFoundError');
    }
}
