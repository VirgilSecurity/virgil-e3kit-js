import { createBrainKey } from 'virgil-pythia';
import {
    SyncKeyStorage,
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    CloudEntryDoesntExistError,
} from '@virgilsecurity/keyknox';
import { VirgilPythiaCrypto, VirgilPublicKey, VirgilPrivateKey } from 'virgil-crypto';
import VirgilToolbox from './VirgilToolbox';
import { KeyEntryStorage } from 'virgil-sdk';
import { WrongKeyknoxPasswordError, PrivateKeyNoBackupError } from './errors';

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
    private localStorage: KeyEntryStorage;
    private keyknoxStorage: KeyEntryStorage;

    constructor(private identity: string, public toolbox: VirgilToolbox) {
        this.localStorage = new KeyEntryStorage('.virgil-local-storage');
        this.keyknoxStorage = new KeyEntryStorage('.virgil-keyknox-storage');
    }

    async savePrivateKeyRemote(privateKey: VirgilPrivateKey, password: string) {
        const storage = await this.getStorage(password);
        return await storage.storeEntry(
            this.identity,
            this.toolbox.virgilCrypto.exportPrivateKey(privateKey),
        );
    }

    async savePrivateKeyLocal(privateKey: VirgilPrivateKey, isPublished?: boolean) {
        return await this.localStorage.save({
            name: this.identity,
            value: this.toolbox.virgilCrypto.exportPrivateKey(privateKey),
            meta: {
                isPublished: String(isPublished),
            },
        });
    }

    async loadLocalPrivateKey() {
        const privateKeyData = await this.localStorage.load(this.identity);
        if (!privateKeyData) return null;
        return this.toolbox.virgilCrypto.importPrivateKey(privateKeyData.value) as VirgilPrivateKey;
    }

    async resetLocalPrivateKey() {
        await Promise.all([
            this.localStorage.remove(this.identity).catch(this.handleResetError),
            this.keyknoxStorage.remove(this.identity),
        ]);
        return true;
    }

    async resetBackupPrivateKey(password: string) {
        const storage = await this.getStorage(password);
        await storage.deleteEntry(this.identity).catch(this.handleResetError);
    }

    async loadRemotePrivateKey(password: string, id?: string) {
        const storage = await this.getStorage(password);
        const rawKey = await storage.retrieveEntry(this.identity);
        await this.localStorage.save({ name: this.identity, value: rawKey.value });
        return this.toolbox.virgilCrypto.importPrivateKey(rawKey.value);
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

    private handleResetError = (e: Error) => {
        if (e instanceof CloudEntryDoesntExistError) {
            throw new PrivateKeyNoBackupError();
        }
        throw e;
    };

    private async generateBrainPair(pwd: string) {
        const brainKey = createBrainKey({
            virgilCrypto: this.toolbox.virgilCrypto,
            virgilPythiaCrypto: this.pythiaCrypto,
            accessTokenProvider: this.toolbox.jwtProvider,
        });

        return await brainKey.generateKeyPair(pwd).catch((e: Error & { code?: number }) => {
            if (typeof e === 'object' && e.code === 60007) {
                const promise = new Promise((resolve, reject) => {
                    const repeat = () =>
                        brainKey
                            .generateKeyPair(pwd)
                            .then(resolve)
                            .catch(reject);
                    setTimeout(repeat, 2000);
                });
                return promise as Promise<KeyPair>;
            }
            throw e;
        });
    }

    private async getStorage(pwd: string) {
        const keyPair = await this.generateBrainPair(pwd);

        const storage = new SyncKeyStorage(
            new CloudKeyStorage(
                new KeyknoxManager(
                    this.toolbox.jwtProvider,
                    keyPair.privateKey,
                    keyPair.publicKey,
                    undefined,
                    new KeyknoxCrypto(this.toolbox.virgilCrypto),
                ),
            ),
            this.keyknoxStorage,
        );
        try {
            await storage.sync();
        } catch (e) {
            throw new WrongKeyknoxPasswordError();
        }
        return storage;
    }
}
