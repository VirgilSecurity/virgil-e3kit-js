import PrivateKeyLoader from './PrivateKeyLoader';
import VirgilToolbox from './VirgilToolbox';
import { CachingJwtProvider } from 'virgil-sdk';
import { VirgilPublicKey, Data } from 'virgil-crypto';
import {
    BootstrapRequiredError,
    PasswordRequiredError,
    EmptyArrayError,
    LookupError,
} from './errors';

const isWithoutErrors = <T>(arr: Array<T | Error>): arr is Array<T> => {
    return !arr.some((el: any) => el instanceof Error);
};

export default class EThree {
    identity: string;
    toolbox: VirgilToolbox;
    private keyLoader: PrivateKeyLoader;

    static async initialize(getToken: () => Promise<string>) {
        const provider = new CachingJwtProvider(getToken);
        const token = await provider.getToken({ operation: 'get' });
        const identity = token.identity();
        return new EThree(identity, provider);
    }

    constructor(identity: string, provider: CachingJwtProvider, toolbox?: VirgilToolbox) {
        this.identity = identity;
        this.toolbox = toolbox || new VirgilToolbox(provider);
        this.keyLoader = new PrivateKeyLoader(identity, this.toolbox);
    }

    async bootstrap(password?: string) {
        const cards = await this.toolbox.cardManager.searchCards(this.identity);
        const hasCard = cards.length > 0;
        const privateKey = await this.localBootstrap(hasCard);
        if (privateKey) return;
        if (hasCard) {
            if (!password) {
                throw new PasswordRequiredError();
            } else {
                await this.keyLoader.loadRemotePrivateKey(password);
                return;
            }
        } else {
            const keyPair = this.toolbox.virgilCrypto.generateKeys();
            if (password) await this.keyLoader.savePrivateKeyRemote(keyPair.privateKey, password);
            await this.keyLoader.savePrivateKeyLocal(keyPair.privateKey);
            await this.toolbox.publishCard(keyPair);
            return;
        }
    }

    async cleanup() {
        return await this.keyLoader.resetLocalPrivateKey();
    }

    async resetPrivateKeyBackup(password: string) {
        return this.keyLoader.resetBackupPrivateKey(password);
    }

    async encrypt(message: Data, publicKeys?: VirgilPublicKey[]): Promise<Data> {
        const isString = typeof message === 'string';
        if (publicKeys && publicKeys.length === 0) throw new EmptyArrayError('encrypt');
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        const publicKeyArray = publicKeys ? [publicKey, ...publicKeys] : [publicKey];
        let res: Data = this.toolbox.virgilCrypto.signThenEncrypt(
            message,
            privateKey,
            publicKeyArray,
        );
        if (isString) res = res.toString('base64');
        return res;
    }

    async decrypt(message: Data, publicKey?: VirgilPublicKey): Promise<Data> {
        const isString = typeof message === 'string';
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        if (!publicKey) publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        let res: Data = this.toolbox.virgilCrypto.decryptThenVerify(message, privateKey, publicKey);
        if (isString) res = res.toString('utf8');
        return res;
    }

    async lookupPublicKeys(identities: string[]): Promise<VirgilPublicKey[]> {
        if (identities.length === 0) throw new EmptyArrayError('lookupKeys');

        const responses = await Promise.all(
            identities.map(i =>
                this.toolbox
                    .getPublicKey(i)
                    .catch(e => Promise.resolve(e instanceof Error ? e : new Error(e))),
            ),
        );

        if (isWithoutErrors(responses)) return responses;

        return Promise.reject(new LookupError(responses));
    }

    async changePassword(oldPassword: string, newPassword: string) {
        await this.bootstrap(oldPassword);
        return await this.keyLoader.changePassword(newPassword);
    }

    async backupPrivateKey(password: string): Promise<void> {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        await this.keyLoader.savePrivateKeyRemote(privateKey, password);
        return;
    }

    private async localBootstrap(hasCard: boolean) {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) return null;
        if (hasCard) return privateKey;
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        await this.toolbox.publishCard({ privateKey, publicKey });
        return privateKey;
    }
}
