import { expect } from 'chai';
import { v4 as uuid } from 'uuid';

import { EThree } from '@virgilsecurity/e3kit-browser';
import { initPythia } from '@virgilsecurity/pythia-crypto';
import {
    initCrypto,
    KeyPairType,
    VirgilAccessTokenSigner,
    VirgilCardCrypto,
    VirgilCrypto,
} from 'virgil-crypto';
import {
    CardManager,
    GeneratorJwtProvider,
    JwtGenerator,
    KeyEntryStorage,
    VirgilCardVerifier,
} from 'virgil-sdk';

const BRAIN_KEY_RATE_LIMIT_DELAY = 2000;

describe('EthreeDocSnippets', () => {
    let virgilCrypto: VirgilCrypto;
    let virgilCardCrypto: VirgilCardCrypto;
    let virgilCardVerifier: VirgilCardVerifier;
    let jwtGenerator: JwtGenerator;
    let generatorJwtProvider: GeneratorJwtProvider;
    let cardManager: CardManager;
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
        cardManager = new CardManager({
            cardCrypto: virgilCardCrypto,
            cardVerifier: virgilCardVerifier,
            accessTokenProvider: generatorJwtProvider,
            retryOnUnauthorized: true,
            apiUrl: process.env.API_URL,
        });
        keyEntryStorage = new KeyEntryStorage('.virgil-local-storage');
        await keyEntryStorage.clear();
    });

    const createFetchToken = (identity: string) => () =>
        Promise.resolve(jwtGenerator.generateToken(identity).toString());

    const initializeEThree = (fetchToken: () => Promise<string>) =>
        EThree.initialize(fetchToken, {
            apiUrl: process.env.API_URL,
            groupStorageName: `.virgil-group-storage/${uuid()}`,
            keyPairType: KeyPairType.ED25519,
        });

    describe('key-backup', () => {
        it('backup_restore_key_with_keyName', async () => {
            const identity = uuid();
            const fetchToken = () =>
                Promise.resolve(jwtGenerator.generateToken(identity).toString());
            const pwd = 'secret_password';
            const keyPassword = uuid();
            const newKeyPassword = uuid();
            const keyName = uuid();

            const eThree = await initializeEThree(fetchToken);
            await eThree.register();

            try {
                // JS (Back up key) >>
                // Backup user's private key to the cloud (encrypted using her password).
                // This will enable your user to log in from another device and have access
                // to the same private key there.
                await eThree.backupPrivateKey(keyPassword, keyName);

                // << JS (Back up key)
            } catch (e) {
                expect(e).to.be.undefined;
            }

            await eThree.cleanup();

            try {
                // JS (Restore key) >>
                // If user wants to restore her private key from backup in Virgil Cloud.
                // While user in session - key can be removed and restore multiply times (via cleanup/restorePrivateKey functions).
                // To know whether private key is present on device now use hasLocalPrivateKey() function:
                const hasLocalPrivateKey = await eThree.hasLocalPrivateKey();
                if (!hasLocalPrivateKey) await eThree.restorePrivateKey(keyPassword, keyName);

                // << JS (Restore key)
            } catch (e) {
                expect(e).to.be.undefined;
            }

            try {
                // JS (Change backup password) >>
                // If the user wants to change his password for private key backup
                await eThree.changePassword(keyPassword, newKeyPassword, keyName);

                // << JS (Change backup password)
            } catch (e) {
                expect(e).to.be.undefined;
            }

            try {
                // JS (Delete backup) >>
                // If user wants to delete their account, use the following function to delete their private key
                await eThree.resetPrivateKeyBackupWithKeyName(keyName);

                // << JS (Delete backup)
            } catch (e) {
                expect(e).to.be.undefined;
            }
        });
    });
});
