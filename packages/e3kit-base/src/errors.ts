/**
 * Custom error class for errors specific to Virgil E3kit.
 */
export class SdkError extends Error {
    constructor(m: string, name = 'SdkError', DerivedClass: any = SdkError) {
        super(m);
        Object.setPrototypeOf(this, DerivedClass.prototype);
        this.name = name;
    }
}

/**
 * Error thrown by {@link EThree.register} when identity is already registered on Virgil Cloud.
 * To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey.
 */
export class IdentityAlreadyExistsError extends SdkError {
    constructor() {
        super(
            'This identity is already registered on Virgil Cloud. To load private key use EThree.restorePrivateKey or EThree.rotatePrivateKey',
            'IdentityAlreadyExistsError',
            IdentityAlreadyExistsError,
        );
    }
}

/**
 * Error thrown by  {@link Ethree.unregister} and {@link EThree.rotatePrivateKey}
 * when current identity of E3kit instance is not registered (i.e. there is
 * no Virgil Card for the current identity in Virgil Cloud).
 */
export class RegisterRequiredError extends SdkError {
    constructor() {
        super('This identity is not registered', 'RegisterRequiredError', RegisterRequiredError);
    }
}

/**
 * Error thrown by {@link EThree.backupPrivateKey},  {@link EThree.changePassword} and
 * {@link EThree.resetPrivateKeyBackup} when user enters wrong password.
 */
export class WrongKeyknoxPasswordError extends SdkError {
    constructor() {
        super(
            'Password from remote private key storage is invalid',
            'WrongKeyknoxPasswordError',
            WrongKeyknoxPasswordError,
        );
    }
}

/**
 * Error thrown by {@link EThree.rotatePrivateKey} and {@link EThree.restorePrivateKey}
 */
export class PrivateKeyAlreadyExistsError extends SdkError {
    constructor() {
        super(
            'You already have a private key. Use EThree.cleanup() to delete it. If you delete the last copy of the private key, you will not be able to decrypt any information encrypted for this private key',
            'PrivateKeyAlreadyExistsError',
            PrivateKeyAlreadyExistsError,
        );
    }
}

/**
 * Error thrown by {@link EThree.resetPrivateKeyBackup} when backup copy of private key doesn't exist
 */
export class PrivateKeyNoBackupError extends SdkError {
    constructor() {
        super(
            "Backup copy of private key doesn't exist",
            'PrivateKeyNoBackupError',
            PrivateKeyNoBackupError,
        );
    }
}

/**
 * Error thrown by {@link EThree.register}, {@link EThree.rotatePrivateKey} and {@link EThree.lookupPublicKeys}
 * when one user has more then one card.
 */
export class MultipleCardsError extends SdkError {
    constructor(public identity: string) {
        super(
            `There are several public keys registered with ${identity}, which is not supported.`,
            'MultipleCardsError',
            MultipleCardsError,
        );
    }
}

/**
 * Error thrown by {@link EThree.decryptFile} in case if signature of the file is not valid.
 */
export class IntegrityCheckFailedError extends SdkError {
    constructor(message: string) {
        super(message, 'IntegrityCheckFailedError', IntegrityCheckFailedError);
    }
}

/**
 * Error thrown by {@link EThree.decryptFile} or {@link EThree.encryptFile} if user aborts an operation.
 */
export class AbortError extends SdkError {
    constructor() {
        super('Operation aborted by user', 'AbortError', AbortError);
    }
}

/**
 * Error thrown by {@link EThree.findUsers} when some of the users's Virgil Cards weren't found.
 */
export class UsersNotFoundError extends SdkError {
    constructor(public identities: string[]) {
        super(
            "Virgil Cards of some of the users weren't found in Virgil Cloud.\n" +
                'Check the "identities" property of this error to see their identites',
            'UsersNotFoundError',
            UsersNotFoundError,
        );
    }
}

/**
 * Error thrown by {@link EThree.findUsers} when some of the users found have more than one Virgil Card,
 * which is not allowed.
 */
export class UsersFoundWithMultipleCardsError extends SdkError {
    constructor(public identities: string[]) {
        super(
            'Some of the users have multiple Virgil Cards in Virgil Cloud, which is not allowed.' +
                'Check the "identities" property of this error to see their identities',
            'UsersFoundWithMultipleCardsError',
            UsersFoundWithMultipleCardsError,
        );
    }
}

export enum GroupErrorCode {
    LocalGroupNotFound = 1,
    PermissionDenied = 2,
    RemoteGroupNotFound = 3,
    InvalidGroup = 4,
    InvalidChangeParticipants = 5,
    InvalidParticipantsCount = 6,
    DataVerificationFailed = 7,
    GroupIdTooShort = 8,
    MessageNotFromThisGroup = 9,
    GroupIsOutdated = 10,
    NoAccess = 11,
}

export class GroupError extends SdkError {
    constructor(public errorCode: GroupErrorCode, message: string) {
        super(message, 'GroupError', GroupError);
    }
}

/**
 * Error thrown when an attempt is made to retrieve the private key from the
 * device's persistent storage, but no private key exists.
 *
 * Thrown by {@link EThree.encrypt}, {@link EThree.decrypt}, {@link EThree.backupPrivateKey},
 * {@link EThree.createGroup}, {@link EThree.loadGroup}, {@link EThree.getGroup},
 * {@link Group.encrypt}, {@link Group.decrypt}, {@link Group.update}, {@link Group.add},
 * {@link Group.remove} and {@link Group.reAdd}.
 */
export class MissingPrivateKeyError extends SdkError {
    constructor() {
        super(
            'No private key found on the device. You should call "register()" of "restorePrivateKey()"',
            'MissingPrivateKeyError',
            MissingPrivateKeyError,
        );
    }
}
