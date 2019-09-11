import initFoundation from '@virgilsecurity/core-foundation';
import {
    getFoundationModules,
    setFoundationModules,
    VirgilPublicKey,
} from '@virgilsecurity/base-crypto';
import { initPythia, getPythiaModules } from '@virgilsecurity/pythia-crypto';
import { CachingJwtProvider } from 'virgil-sdk';

import { cryptoModulesLoaded } from './utils/cryptoModulesLoaded';
import { withDefaults } from './utils/object';
import { prepareBaseConstructorParams } from './utils/prepareBaseConstructorParams';
import { AbstractEThree } from './AbstractEThree';
import { throwGetTokenNotAFunction } from './utils/error';
import { EThreeInitializeOptions, EThreeCtorOptions } from './types';
import { IPublicKey } from './externalTypes';

export class EThreeNode extends AbstractEThree {
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
    ): Promise<EThreeNode> {
        const modulesToLoad: Promise<void>[] = [];
        if (!cryptoModulesLoaded(getFoundationModules)) {
            modulesToLoad.push(initFoundation().then(setFoundationModules));
        }
        if (!cryptoModulesLoaded(getPythiaModules)) {
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
        return new EThreeNode(identity, opts);
    }

    /**
     * @hidden
     */
    protected isPublicKey(publicKey: IPublicKey) {
        return publicKey instanceof VirgilPublicKey;
    }
}
