import { createBrainKey } from 'virgil-pythia';
import {
    SyncKeyStorage,
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
} from '@virgilsecurity/keyknox';
import {
    VirgilPythiaCrypto,
    VirgilPublicKey,
    VirgilPrivateKey,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import VirgilToolbox from './VirgilToolbox';
import { KeyEntryStorage } from 'virgil-sdk';
import { PasswordRequiredError, WrongKeyknoxPasswordError, BootstrapRequiredError } from './errors';

type KeyPair = {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
};
export interface IBrainKey {
    generateKeyPair(password: string, id?: string): Promise<KeyPair>;
}

export interface IPrivateKeyLoaderParams {
    dbName: string;
}

export interface PrivateKeyEntry {
    privateKey: VirgilPrivateKey;
    meta: {
        isPublished: boolean;
    };
}

export default class PrivateKeyLoader {
    private pythiaCrypto = new VirgilPythiaCrypto();
    private brainKey: IBrainKey;
    private syncStorage?: Promise<SyncKeyStorage>;
    private localStorage: KeyEntryStorage;

    constructor(
        private identity: string,
        public toolbox: VirgilToolbox,
        { dbName }: IPrivateKeyLoaderParams = { dbName: 'keyknox-storage' },
    ) {
        this.brainKey = createBrainKey({
            virgilCrypto: this.toolbox.virgilCrypto,
            virgilPythiaCrypto: this.pythiaCrypto,
            accessTokenProvider: this.toolbox.jwtProvider,
        });
        this.localStorage = new KeyEntryStorage({ name: dbName });
    }

    async loadPrivateKey(password?: string, id?: string) {
        const privateKey = await this.loadLocalPrivateKey();
        if (privateKey) return privateKey;
        if (!password) throw new PasswordRequiredError();
        return this.loadRemotePrivateKey(password, id);
    }

    async savePrivateKeyRemote(privateKey: VirgilPrivateKey, password: string, id?: string) {
        const storage = await this.initStorage(password);
        await storage.storeEntry(
            this.identity,
            this.toolbox.virgilCrypto.exportPrivateKey(privateKey),
        );
    }

    async savePrivateKeyLocal(privateKey: VirgilPrivateKey) {
        this.localStorage.save({
            name: this.identity,
            value: this.toolbox.virgilCrypto.exportPrivateKey(privateKey),
        });
    }

    async loadLocalPrivateKey() {
        const privateKeyData = await this.localStorage.load(this.identity);
        if (!privateKeyData) return null;
        return this.toolbox.virgilCrypto.importPrivateKey(privateKeyData.value) as VirgilPrivateKey;
    }

    async deleteKeys() {
        if (this.syncStorage) this.syncStorage = undefined;
        return await this.localStorage.remove(this.identity);
    }

    async loadRemotePrivateKey(password: string, id?: string) {
        const storage = await this.initStorage(password);

        const key = await storage.retrieveEntry(this.identity);
        return this.toolbox.virgilCrypto.importPrivateKey(key.value) as VirgilPrivateKey;
    }

    async changePassword(newPassword: string) {
        if (!this.syncStorage) throw new BootstrapRequiredError();
        const storage = await this.syncStorage;
        const keyPair = await this.generateBrainPair(newPassword);

        const update = await storage.updateRecipients({
            newPrivateKey: keyPair.privateKey,
            newPublicKeys: [keyPair.publicKey],
        });
        return update;
    }

    private async createSyncStorage(password: string) {
        const { privateKey, publicKey } = await this.generateBrainPair(password);
        const storage = new SyncKeyStorage(
            new CloudKeyStorage(
                new KeyknoxManager(
                    this.toolbox.jwtProvider,
                    privateKey,
                    publicKey,
                    undefined,
                    new KeyknoxCrypto(this.toolbox.virgilCrypto),
                ),
            ),
            this.localStorage,
        );
        try {
            await storage.sync();
        } catch (e) {
            throw new WrongKeyknoxPasswordError();
        }

        return storage;
    }

    private async initStorage(password: string) {
        if (!this.syncStorage) this.syncStorage = this.createSyncStorage(password);
        try {
            await this.syncStorage;
        } catch (e) {
            this.syncStorage = undefined;
            throw e;
        }
        return this.syncStorage;
    }

    private generateBrainPair = (password: string) =>
        this.brainKey.generateKeyPair(password).catch(e => {
            if (typeof e === 'object' && e.code === 60007) {
                const promise = new Promise((resolve, reject) => {
                    setTimeout(
                        () =>
                            this.brainKey
                                .generateKeyPair(password)
                                .then(resolve)
                                .catch(reject),
                        2000,
                    );
                });
                return promise as Promise<KeyPair>;
            }
            throw e;
        });
}
