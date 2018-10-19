/**
 * Custom error class for errors specific to Virgil SDK.
 */
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
