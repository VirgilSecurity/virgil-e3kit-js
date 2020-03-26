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
    FindUsersResult,
    Ticket,
    GroupInfo,
    RawGroup,
} from '@virgilsecurity/e3kit-base';
export { KeyPairType } from 'virgil-crypto';
export { EThree } from './EThree';
export { EThreeInitializeOptions, EThreeCtorOptions } from './types';
