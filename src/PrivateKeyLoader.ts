import { createBrainKey } from 'virgil-pythia';
import {
    SyncKeyStorage,
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    KeyEntryDoesntExistError,
} from '@virgilsecurity/keyknox';
import {
    VirgilPythiaCrypto,
    VirgilPublicKey,
    VirgilPrivateKey,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import VirgilToolbox from './VirgilToolbox';
import { KeyEntryStorage } from 'virgil-sdk';
import { PasswordRequiredError, WrongKeyknoxPasswordError } from './errors';

export interface IBrainKey {
    generateKeyPair(
        password: string,
        id?: string,
    ): Promise<{
        privateKey: VirgilPrivateKey;
        publicKey: VirgilPublicKey;
    }>;
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
        if (!this.syncStorage) this.syncStorage = this.createSyncStorage(password, id);
        const storage = await this.syncStorage;
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
        this.localStorage.remove(this.identity);
        if (this.syncStorage) this.syncStorage = undefined;
    }

    async loadRemotePrivateKey(password: string, id?: string) {
        if (!this.syncStorage) this.syncStorage = this.createSyncStorage(password, id);
        let storage;
        try {
            storage = await this.syncStorage;
        } catch (e) {
            throw new WrongKeyknoxPasswordError();
        }

        const key = await storage.retrieveEntry(this.identity);
        return this.toolbox.virgilCrypto.importPrivateKey(key.value) as VirgilPrivateKey;
    }

    private async createSyncStorage(password: string, id?: string) {
        const { privateKey, publicKey } = await this.brainKey.generateKeyPair(password, id);
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

        await storage.sync();

        return storage;
    }
}
