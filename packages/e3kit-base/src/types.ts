export type NodeBuffer = import('@virgilsecurity/crypto-types').NodeBuffer;
export type Data = import('@virgilsecurity/crypto-types').Data;
export type IKeyPair = import('@virgilsecurity/crypto-types').IKeyPair;
export type IPrivateKey = import('@virgilsecurity/crypto-types').IPrivateKey;
export type IPublicKey = import('@virgilsecurity/crypto-types').IPublicKey;
export type ICrypto = import('@virgilsecurity/crypto-types').ICrypto;
export type ICardCrypto = import('@virgilsecurity/crypto-types').ICardCrypto;
export type IBrainKeyCrypto = import('@virgilsecurity/crypto-types').IBrainKeyCrypto;
export type IGroupSession = import('@virgilsecurity/crypto-types').IGroupSession;
export type IGroupSessionMessageInfo = import('@virgilsecurity/crypto-types').IGroupSessionMessageInfo;

export type IAccessTokenProvider = import('virgil-sdk').IAccessTokenProvider;
export type IKeyEntryStorage = import('virgil-sdk').IKeyEntryStorage;
export type ICard = import('virgil-sdk').ICard;
export type IKeyEntry = import('virgil-sdk').IKeyEntry;

export interface EThreeInitializeOptions {
    /**
     * Implementation of IKeyEntryStorage. Used IndexedDB Key Storage from
     * [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript) by default.
     */
    keyEntryStorage?: IKeyEntryStorage;
    /**
     * Url of the Card Services. Used for development purposes.
     */
    apiUrl?: string;
    /**
     * Indicates whether to use old algorithm to calculate keypair identifiers.
     */
    useSha256Identifiers?: boolean;
    /**
     * Name of the IndexedDB database. Default `.virgil-local-storage`.
     */
    storageName?: string;
}

/**
 * @hidden
 */
export interface EThreeCtorOptions extends EThreeInitializeOptions {
    /**
     * Implementation of IAccessTokenProvider from [Virgil SDK](https://github.com/virgilsecurity/virgil-sdk-javascript);
     */
    accessTokenProvider: IAccessTokenProvider;
}

/**
 * Dictionary returned from lookupPublicKey method
 *
 * @deprecated since version 0.7.0
 * Will be removed in version 0.8.0
 */
export type LookupResult = {
    [identity: string]: IPublicKey;
};

/**
 * Argument for encrypt function can be single IPublicKey or LookupResult
 *
 * @deprecated since version 0.7.0
 * Will be removed in version 0.8.0
 */
export type EncryptPublicKeyArg = LookupResult | IPublicKey;

/**
 * Dictionary returned from {@link Ethree.findUsers} method when searching for multiple users.
 */
export type FindUsersResult = {
    [identity: string]: ICard;
};

export interface Ticket {
    groupSessionMessage: IGroupSessionMessageInfo;
    participants: string[];
}

export interface GroupInfo {
    initiator: string;
}

export interface RawGroup {
    info: GroupInfo;
    tickets: Ticket[];
}
