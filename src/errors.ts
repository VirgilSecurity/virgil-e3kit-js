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
            'This identity already registered on Virgil Cloud. Please load private key using EThree.restorePrivateKey or EThree.rotatePrivateKey',
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
