import {
    CloudKeyStorage,
    KeyknoxManager,
    KeyknoxCrypto,
    CloudEntryDoesntExistError,
    KeyknoxClient
} from '@virgilsecurity/keyknox';
import { VirgilAgent } from 'virgil-sdk';

import { generateBrainPair } from './brainkey';
import { WrongKeyknoxPasswordError, PrivateKeyNoBackupError } from './errors';
import {
    IPrivateKey,
    ICrypto,
    IBrainKeyCrypto,
    IAccessTokenProvider,
    IKeyEntryStorage,
    IKeyPair,
} from './types';
import {isString} from "./typeguards";

/**
 * @hidden
 */
export interface PrivateKeyLoaderOptions {
    virgilCrypto: ICrypto;
    brainKeyCrypto: IBrainKeyCrypto;
    accessTokenProvider: IAccessTokenProvider;
    keyEntryStorage: IKeyEntryStorage;
    apiUrl?: string;
}

/**
 * @hidden
 */
export class PrivateKeyLoader {
    private localStorage: IKeyEntryStorage;
    private keyknoxClient = new KeyknoxClient(
        this.options.accessTokenProvider,
        this.options.apiUrl,
        undefined,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        new VirgilAgent(
            process.env.__VIRGIL_PRODUCT_NAME__!,
            process.env.__VIRGIL_PRODUCT_VERSION__!,
        ),
    );
    private keyknoxCrypto = new KeyknoxCrypto(this.options.virgilCrypto);
    private cachedPrivateKey: IPrivateKey | null = null;

    constructor(public identity: string, public options: PrivateKeyLoaderOptions) {
        this.localStorage = options.keyEntryStorage;
    }

    async savePrivateKeyRemote(privateKey: IPrivateKey, password: string, keyName?: string) {
            const storage = await this.getStorage(password, isString(keyName));
            return await storage.storeEntry(
                this.identity,
                this.options.virgilCrypto.exportPrivateKey(privateKey).toString('base64'),
                keyName
            );
    }

    async savePrivateKeyLocal(privateKey: IPrivateKey) {
        this.cachedPrivateKey = privateKey;
        return await this.localStorage.save({
            name: this.identity,
            value: this.options.virgilCrypto.exportPrivateKey(privateKey).toString('base64'),
        });
    }

    async loadLocalPrivateKey(): Promise<IPrivateKey | null> {
        if (this.cachedPrivateKey) return this.cachedPrivateKey;
        const privateKeyData = await this.localStorage.load(this.identity);
        if (!privateKeyData) return null;
        return this.importAndCachePrivateKey(privateKeyData.value);
    }

    async loadLocalKeyPair(): Promise<IKeyPair | null> {
        const privateKey = await this.loadLocalPrivateKey();
        if (!privateKey) return null;
        const publicKey = this.options.virgilCrypto.extractPublicKey(privateKey);
        return { privateKey, publicKey };
    }

    async resetLocalPrivateKey() {
        await this.localStorage.remove(this.identity);
        this.cachedPrivateKey = null;
    }

    async resetPrivateKeyBackup(password: string) {
        const storage = await this.getStorage(password);
        await storage.deleteEntry(this.identity).catch(this.handleResetError);
    }

    async resetAll() {
        await this.keyknoxClient.v1Reset();
    }

    async restorePrivateKey(password: string, keyName?: string): Promise<IPrivateKey> {
        const storage = await this.getStorage(password, isString(keyName));
        try {
            const rawKey = !isString(keyName) ? storage.retrieveEntry(this.identity) : await storage.fetchEntryByKey(this.identity, keyName);
            await this.localStorage.save({name: this.identity, value: rawKey.data});
            return this.importAndCachePrivateKey(rawKey.data);
        } catch (e) {
            if (e instanceof CloudEntryDoesntExistError) {
                throw new PrivateKeyNoBackupError();
            }
            throw e;
        }
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
        return generateBrainPair(pwd, {
            virgilCrypto: this.options.virgilCrypto,
            pythiaCrypto: this.options.brainKeyCrypto,
            accessTokenProvider: this.options.accessTokenProvider,
            apiUrl: this.options.apiUrl,
        });
    }

    private async getStorage(pwd: string, skipCloudSync = false) {
        const keyPair = await this.generateBrainPair(pwd);

        const storage = new CloudKeyStorage(
            new KeyknoxManager(this.keyknoxCrypto, this.keyknoxClient),
            keyPair.privateKey,
            keyPair.publicKey,
        );
        if(!skipCloudSync) {
            try {
                await storage.retrieveCloudEntries();
            } catch (e) {
                if (e.name === 'FoundationError' || e.name === 'RNVirgilCryptoError') {
                    throw new WrongKeyknoxPasswordError();
                }
                throw e;
            }
        }
        return storage;
    }

    private importAndCachePrivateKey(rawKeyData: string) {
        this.cachedPrivateKey = this.options.virgilCrypto.importPrivateKey({
            value: rawKeyData,
            encoding: 'base64',
        });
        return this.cachedPrivateKey;
    }
}
