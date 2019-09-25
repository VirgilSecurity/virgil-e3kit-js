import { IPublicKey } from './externalTypes';

/**
 * Custom error class for errors specific to Virgil E3kit.
 */
export class SdkError extends Error {
    constructor(m: string, name = 'SdkError') {
        super(m);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = name;
    }
}

/**
 * Error thrown by {@link EThree.register} when identity is already registered on Virgil Cloud.
 * To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey.
 */
export class IdentityAlreadyExistsError extends Error {
    constructor() {
        super(
            'This identity is already registered on Virgil Cloud. To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey',
        );
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'IdentityAlreadyExistsError';
    }
}

/**
 * Error thrown by {@link EThree.encrypt}, {@link EThree.decrypt},
 * {@link Ethree.unregister} and {@link EThree.backupPrivateKey}
 * when current identity of E3kit instance is not registered.
 */
export class RegisterRequiredError extends Error {
    constructor() {
        super('This identity is not registered');
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'RegisterRequiredError';
    }
}

/**
 * Error thrown by {@link EThree.backupPrivateKey},  {@link EThree.changePassword} and
 * {@link EThree.resetPrivateKeyBackup} when user enters wrong password.
 */
export class WrongKeyknoxPasswordError extends Error {
    constructor() {
        super('Password from remote private key storage is invalid');
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'WrongKeyknoxPasswordError';
    }
}

/**
 * Error thrown by {@link EThree.rotatePrivateKey} and {@link EThree.restorePrivateKey}
 */
export class PrivateKeyAlreadyExistsError extends Error {
    constructor() {
        super(
            'You already have a private key. Use EThree.cleanup() to delete it. If you delete the last copy of the private key, you will not be able to decrypt any information encrypted for this private key',
        );
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'PrivateKeyAlreadyExistsError';
    }
}

/**
 * Error thrown by {@link EThree.resetPrivateKeyBackup} when backup copy of private key doesn't exist
 */
export class PrivateKeyNoBackupError extends Error {
    constructor() {
        super("Backup copy of private key doesn't exist");
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'PrivateKeyNoBackupError';
    }
}

/**
 * Error thrown by {@link EThree.register}, {@link EThree.rotatePrivateKey} and {@link EThree.lookupPublicKeys}
 * when one user has more then one card.
 */
export class MultipleCardsError extends Error {
    constructor(public identity: string) {
        super(`There are several public keys registered with ${identity}, which is not supported.`);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'MultipleCardsError';
    }
}

export type LookupResultWithErrors = {
    [identity: string]: IPublicKey | Error;
};

/**
 * Error thrown by {@link EThree.lookupPublicKeys} in case if some identity missing or has multiple cards.
 */
export class LookupError extends Error {
    /**
     * Key Value object, where key is identity and value is IPublicKey or [[MultipleCardsError]] or [[LookupNotFoundError]]
     */
    public lookupResult: LookupResultWithErrors;
    constructor(lookupResult: LookupResultWithErrors) {
        super(
            'Failed some public keys lookups. You can see the results by calling error.lookupResult property of this error instance',
        );
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'LookupError';
        this.lookupResult = lookupResult;
    }
}

/**
 * Error thrown by {@link EThree.lookupPublicKeys} in case if sought identity is not registered.
 */
export class LookupNotFoundError extends Error {
    constructor(public identity: string) {
        super(`${identity} not found`);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'LookupNotFoundError';
    }
}

/**
 * Error thrown by {@link EThree.decryptFile} in case if signature of the file is not valid.
 */
export class IntegrityCheckFailedError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'IntegrityCheckFailedError';
    }
}

/**
 * Error thrown by {@link EThree.decryptFile} or {@link EThree.encryptFile} if user aborts an operation.
 */
export class AbortError extends Error {
    constructor() {
        super('Operation aborted by user');
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'AbortError';
    }
}
