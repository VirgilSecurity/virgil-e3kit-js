import { version } from '../package.json';

process.env.__VIRGIL_PRODUCT_NAME__ = 'e3kit';
process.env.__VIRGIL_PRODUCT_VERSION__ = version;

export {
    // errors
    SdkError,
    IdentityAlreadyExistsError,
    RegisterRequiredError,
    WrongKeyknoxPasswordError,
    PrivateKeyAlreadyExistsError,
    PrivateKeyNoBackupError,
    MultipleCardsError,
    LookupResultWithErrors,
    LookupError,
    LookupNotFoundError,
    IntegrityCheckFailedError,
    AbortError,
    GroupErrorCode,
    GroupError,
    MissingPrivateKeyError,
    // types
    NodeBuffer,
    Data,
    IKeyPair,
    IPrivateKey,
    IPublicKey,
    ICrypto,
    ICardCrypto,
    IBrainKeyCrypto,
    IAccessTokenProvider,
    ICard,
    IKeyEntryStorage,
    IKeyEntry,
    LookupResult,
    EncryptPublicKeyArg,
    FindUsersResult,
    Ticket,
    GroupInfo,
    RawGroup,
} from '@virgilsecurity/e3kit-base';
export { KeyPairType } from 'virgil-crypto';
export { EThree } from './EThree';
export { EThreeInitializeOptions, EThreeCtorOptions } from './types';
