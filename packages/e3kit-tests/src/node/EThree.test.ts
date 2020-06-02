import { EThree } from '@virgilsecurity/e3kit-node';
import { VirgilCrypto, VirgilCardCrypto, initCrypto, VirgilAccessTokenSigner } from 'virgil-crypto';
import {
    VirgilCardVerifier,
    JwtGenerator,
    GeneratorJwtProvider,
    KeyEntryStorage,
} from 'virgil-sdk';
import { initPythia } from '@virgilsecurity/pythia-crypto';
import uuid from 'uuid/v4';

describe.only('EThree initialization', () => {
    let virgilCrypto: VirgilCrypto;
    let virgilCardCrypto: VirgilCardCrypto;
    let virgilCardVerifier: VirgilCardVerifier;
    let jwtGenerator: JwtGenerator;
    let generatorJwtProvider: GeneratorJwtProvider;
    // let cardManager: CardManager;
    let keyEntryStorage: KeyEntryStorage;

    before(async () => {
        await Promise.all([initCrypto(), initPythia()]);
    });

    beforeEach(async () => {
        virgilCrypto = new VirgilCrypto();
        virgilCardCrypto = new VirgilCardCrypto(virgilCrypto);
        virgilCardVerifier = new VirgilCardVerifier(virgilCardCrypto, {
            verifySelfSignature: false,
            verifyVirgilSignature: false,
        });
        jwtGenerator = new JwtGenerator({
            appId: process.env.APP_ID!,
            apiKeyId: process.env.APP_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.APP_KEY!),
            accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
        });
        generatorJwtProvider = new GeneratorJwtProvider(
            jwtGenerator,
            undefined,
            'default_identity',
        );
        keyEntryStorage = new KeyEntryStorage('.virgil-local-storage');
        await keyEntryStorage.clear();
    });

    const createFetchToken = (identity: string) => () =>
        Promise.resolve(jwtGenerator.generateToken(identity).toString());

    it('should initialize with custom group name', () => {
        EThree.initialize(createFetchToken(uuid()), {
            groupStorageName: `d:/program files/${uuid()}`,
        });
    });
});
