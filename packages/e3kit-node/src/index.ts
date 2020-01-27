process.env.__VIRGIL_PRODUCT_NAME__ = process.env.SET_PRODUCT_NAME;
process.env.__VIRGIL_PRODUCT_VERSION__ = process.env.SET_PRODUCT_VERSION;

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
    EThreeInitializeOptions,
    EThreeCtorOptions,
    LookupResult,
    EncryptPublicKeyArg,
    FindUsersResult,
    Ticket,
    GroupInfo,
    RawGroup,
} from '@virgilsecurity/e3kit-base';
export { EThree } from './EThree';
