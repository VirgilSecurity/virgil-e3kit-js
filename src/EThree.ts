import PrivateKeyLoader from './PrivateKeyLoader';
import VirgilToolbox from './virgilToolbox';
import { CachingJwtProvider } from 'virgil-sdk';
import { VirgilPublicKey, VirgilPrivateKey } from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import { BootstrapRequiredError, PasswordRequiredError, EmptyArrayError } from './errors';

export default class EThree {
    private identity: string;
    private toolbox: VirgilToolbox;
    private keyLoader: PrivateKeyLoader;

    static async init(getToken: () => Promise<string>) {
        const provider = new CachingJwtProvider(getToken);
        const token = await provider.getToken({ operation: 'get' });
        const identity = token.identity();
        return new EThree(identity, provider);
    }

    constructor(identity: string, provider: CachingJwtProvider) {
        this.identity = identity;
        this.toolbox = new VirgilToolbox(provider);
        this.keyLoader = new PrivateKeyLoader(identity, this.toolbox);
    }

    async bootstrap(password?: string) {
        const publicKeys = await this.toolbox.getPublicKeys(this.identity);
        const privateKey = await this.localBootstrap(publicKeys);
        if (privateKey) return;
        if (publicKeys.length > 0) {
            if (!password) {
                throw new PasswordRequiredError();
            } else {
                await this.keyLoader.loadRemotePrivateKey(password);
                return;
            }
        } else {
            const keyPair = this.toolbox.virgilCrypto.generateKeys();
            if (password) await this.keyLoader.savePrivateKeyRemote(keyPair.privateKey, password);
            else await this.keyLoader.savePrivateKeyLocal(keyPair.privateKey);
            await this.toolbox.createCard(keyPair);
            return;
        }
    }

    async logout() {
        return await this.keyLoader.deleteKeys();
    }

    async encrypt(message: string, publicKeys?: VirgilPublicKey[]) {
        if (publicKeys && publicKeys.length === 0) throw new EmptyArrayError('encrypt');
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        const publicKeyArray = publicKeys ? [publicKey, ...publicKeys] : [publicKey];
        return this.toolbox.virgilCrypto
            .signThenEncrypt(message, privateKey, publicKeyArray)
            .toString('base64');
    }

    async decrypt(message: string, publicKeys?: VirgilPublicKey[]) {
        if (publicKeys && publicKeys.length === 0) throw new EmptyArrayError('decrypt');
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        const publicKeyArray = publicKeys ? [publicKey, ...publicKeys] : [publicKey];
        return this.toolbox.virgilCrypto
            .decryptThenVerify(message, privateKey, publicKeyArray)
            .toString('utf8');
    }

    async lookupKeys(identities: string[]) {
        if (identities.length === 0) throw new EmptyArrayError('lookupKeys');
        const keysArr = await Promise.all(identities.map(this.toolbox.getPublicKeys));
        // TODO handle multiple public keys:
        return keysArr
            .map(arr => (arr.length === 1 ? arr[0] : arr[arr.length - 1]))
            .map(k => (k === undefined ? null : k));
    }

    private async localBootstrap(publicKeys: VirgilPublicKey[]) {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) return null;
        if (publicKeys.length > 0) return privateKey;
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        await this.toolbox.createCard({ privateKey, publicKey });
        return privateKey;
    }
}
