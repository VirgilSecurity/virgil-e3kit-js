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
            'This identity is already registered on Virgil Cloud. To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey',
            'IdentityAlreadyExistsError',
        );
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

export class PrivateKeyAlreadyExistsError extends SdkError {
    constructor() {
        super(
            'You already have a private key. Use EThree.cleanup() to delete it. If you delete the last copy of the private key, you will not be able to decrypt any information encrypted for this private key',
            'PrivateKeyAlreadyExistsError',
        );
    }
}

export class PrivateKeyNoBackupError extends SdkError {
    constructor() {
        super("Backup copy of private key doesn't exist", 'PrivateKeyNoBackupError');
    }
}

export class MultipleCardsError extends SdkError {
    constructor(public identity: string) {
        super(
            `There are several public keys registered with ${identity}, which is not supported.`,
            'MultipleCardsError',
        );
    }
}

type ErrorWithIdenetiy = { identity: string } & Error;
type LookupResult = import('./EThree').LookupResult;

export class LookupError extends SdkError {
    constructor(public resolved: Array<LookupResult>, public rejected: ErrorWithIdenetiy[]) {
        super(
            `Failed some public keys lookups. You can see the results by calling error.resolved and error.rejected properties of this error instance`,
            'LookupError',
        );
        console.error(this.rejected.map(obj => obj.toString()).join('\n'));
    }
}

export class LookupNotFoundError extends SdkError {
    constructor(public identity: string) {
        super(`${identity} not found`, 'LookupNotFoundError');
    }
}
