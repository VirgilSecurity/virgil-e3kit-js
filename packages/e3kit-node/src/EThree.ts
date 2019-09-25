import {
    hasFoundationModules,
    setFoundationModules,
    VirgilPublicKey,
} from '@virgilsecurity/base-crypto';
import initFoundation from '@virgilsecurity/core-foundation';
import { AbstractEThree } from '@virgilsecurity/e3kit-base';
import { initPythia, hasPythiaModules } from '@virgilsecurity/pythia-crypto';
import { CachingJwtProvider } from 'virgil-sdk';

import { throwGetTokenNotAFunction } from './utils/error';
import { withDefaults } from './utils/object';
import { prepareBaseConstructorParams } from './utils/prepareBaseConstructorParams';
import { IPublicKey, EThreeInitializeOptions, EThreeCtorOptions } from './types';

export class EThree extends AbstractEThree {
    /**
     * @hidden
     * @param identity - Identity of the current user.
     */
    // @ts-ignore
    constructor(identity: string, options: EThreeCtorOptions) {
        super(prepareBaseConstructorParams(identity, options));
    }

    /**
     * Initialize a new instance of EThree which tied to specific user.
     * @param getToken - Function that receive JWT.
     */
    static async initialize(
        getToken: () => Promise<string>,
        options: EThreeInitializeOptions = {},
    ): Promise<EThree> {
        const modulesToLoad: Promise<void>[] = [];
        if (!hasFoundationModules()) {
            modulesToLoad.push(initFoundation().then(setFoundationModules));
        }
        if (!hasPythiaModules()) {
            modulesToLoad.push(initPythia());
        }
        await Promise.all(modulesToLoad);

        if (typeof getToken !== 'function') throwGetTokenNotAFunction(typeof getToken);

        const opts = withDefaults(options as EThreeCtorOptions, {
            accessTokenProvider: new CachingJwtProvider(getToken),
        });
        const token = await opts.accessTokenProvider.getToken({
            service: 'cards',
            operation: '',
        });
        const identity = token.identity();
        return new EThree(identity, opts);
    }

    /**
     * @hidden
     */
    isPublicKey(publicKey: IPublicKey) {
        return publicKey instanceof VirgilPublicKey;
    }
}
