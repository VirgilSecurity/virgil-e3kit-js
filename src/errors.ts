import { VirgilPublicKey } from 'virgil-crypto';

export class SdkError extends Error {
    name: string;
    constructor(m: string, name: string = 'SdkError') {
        super(m);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = name;
    }
}

export class PasswordRequiredError extends SdkError {
    constructor() {
        super('Password required', 'PasswordRequiredError');
    }
}

export class PrivateKeyNotFoundError extends SdkError {
    constructor() {
        super('Private key not found', 'PrivateKeyNotFoundError');
    }
}

export class BootstrapRequiredError extends SdkError {
    constructor() {
        super('Bootstrap required', 'BootstrapRequiredError');
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

const isError = (arg: any): arg is Error => arg instanceof Error;
const isPublicKey = (arg: any): arg is VirgilPublicKey => !(arg instanceof Error);

export class LookupError extends SdkError {
    result: Array<VirgilPublicKey | Error>;

    get rejected(): Error[] {
        return this.result.filter(isError);
    }
    get resolved(): VirgilPublicKey[] {
        return this.result.filter(isPublicKey);
    }

    constructor(result: Array<VirgilPublicKey | Error>) {
        super(
            'Some promises got rejected. Use err.rejected for unhandled results, .resolved for handled and .result for all responses',
            'LookupError',
        );
        this.result = result;
    }
}

export class LookupNotFoundError extends SdkError {
    constructor(public identity: string) {
        super(`${identity} not found`, 'LookupNotFoundError');
    }
}
