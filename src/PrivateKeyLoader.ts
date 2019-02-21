import { createBrainKey } from 'virgil-pythia';
import {
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    CloudEntryDoesntExistError,
    unsafeResetAllEntries,
} from '@virgilsecurity/keyknox';
import {
    VirgilPythiaCrypto,
    VirgilPrivateKey,
    VirgilCrypto,
} from 'virgil-crypto/dist/virgil-crypto-pythia.es';
import { IKeyEntryStorage, IAccessTokenProvider } from 'virgil-sdk';
import { WrongKeyknoxPasswordError, PrivateKeyNoBackupError } from './errors';
import { createThrottlingHandler } from './utils/handlers';

export interface IPrivateKeyLoaderOptions {
    virgilCrypto: VirgilCrypto;
    accessTokenProvider: IAccessTokenProvider;
    keyEntryStorage: IKeyEntryStorage;
}

export default class PrivateKeyLoader {
    private pythiaCrypto = new VirgilPythiaCrypto();
    private localStorage: IKeyEntryStorage;

    constructor(private identity: string, public options: IPrivateKeyLoaderOptions) {
        this.localStorage = options.keyEntryStorage;
    }

    async savePrivateKeyRemote(privateKey: VirgilPrivateKey, password: string) {
        const storage = await this.getStorage(password);
        return await storage.storeEntry(
            this.identity,
            this.options.virgilCrypto.exportPrivateKey(privateKey),
        );
    }

    async savePrivateKeyLocal(privateKey: VirgilPrivateKey) {
        return await this.localStorage.save({
            name: this.identity,
            value: this.options.virgilCrypto.exportPrivateKey(privateKey),
        });
    }

    async loadLocalPrivateKey() {
        const privateKeyData = await this.localStorage.load(this.identity);
        if (!privateKeyData) return null;
        return this.options.virgilCrypto.importPrivateKey(privateKeyData.value) as VirgilPrivateKey;
    }

    async resetLocalPrivateKey() {
        await this.localStorage.remove(this.identity).catch(this.handleResetError);
    }

    async resetPrivateKeyBackup(password: string) {
        const storage = await this.getStorage(password);
        await storage.deleteEntry(this.identity).catch(this.handleResetError);
    }

    async resetAll() {
        return await unsafeResetAllEntries(this.options.accessTokenProvider);
    }

    async restorePrivateKey(password: string) {
        const storage = await this.getStorage(password);
        const rawKey = storage.retrieveEntry(this.identity);
        await this.localStorage.save({ name: this.identity, value: rawKey.data });
        return this.options.virgilCrypto.importPrivateKey(rawKey.data);
    }

    async changePassword(oldPwd: string, newPwd: string) {
        const storage = await this.getStorage(oldPwd);
        const keyPair = await this.generateBrainPair(newPwd);
        const update = await storage.updateRecipients({
            newPrivateKey: keyPair.privateKey,
            newPublicKeys: [keyPair.publicKey],
        });
        return update;
    }

    hasPrivateKey() {
        return this.localStorage.exists(this.identity);
    }

    private handleResetError = (e: Error) => {
        if (e instanceof CloudEntryDoesntExistError) {
            throw new PrivateKeyNoBackupError();
        }
        throw e;
    };

    private async generateBrainPair(pwd: string) {
        const brainKey = createBrainKey({
            virgilCrypto: this.options.virgilCrypto,
            virgilPythiaCrypto: this.pythiaCrypto,
            accessTokenProvider: this.options.accessTokenProvider,
        });
        const errorHandler = createThrottlingHandler(brainKey, pwd);
        return await brainKey.generateKeyPair(pwd).catch(errorHandler);
    }

    private async getStorage(pwd: string) {
        const keyPair = await this.generateBrainPair(pwd);

        const storage = new CloudKeyStorage(
            new KeyknoxManager(
                this.options.accessTokenProvider,
                keyPair.privateKey,
                keyPair.publicKey,
                undefined,
                new KeyknoxCrypto(this.options.virgilCrypto),
            ),
        );
        try {
            await storage.retrieveCloudEntries();
        } catch (e) {
            if (e.name === 'VirgilCryptoError') throw new WrongKeyknoxPasswordError();
            throw e;
        }
        return storage;
    }
}
