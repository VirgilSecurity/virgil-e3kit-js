import { VirgilPrivateKey, VirgilPublicKey } from 'virgil-crypto';
import { IAccessTokenProvider } from 'virgil-sdk';
import { EThreeInitializeOptions } from '../types';

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
 * @hidden
 */
export type KeyPair = {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
};
