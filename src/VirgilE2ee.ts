import KeyknoxLoader from './KeyknoxLoader';
import VirgilToolbox from './virgilToolbox';
import { Jwt, CachingJwtProvider } from 'virgil-sdk';
import { VirgilPublicKey, VirgilPrivateKey } from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import { BootstrapRequiredError, PrivateKeyNotFoundError, PasswordRequiredError } from './errors';

export default class EThree {
    identity: string;
    toolbox: VirgilToolbox;
    private keyLoader: KeyknoxLoader;

    static async init(getToken: () => Promise<string>) {
        const provider = new CachingJwtProvider(getToken);
        const token = await provider.getToken({ operation: 'get' });
        const identity = token.identity();
        return new EThree(identity, provider);
    }

    constructor(identity: string, provider: CachingJwtProvider) {
        this.identity = identity;
        this.toolbox = new VirgilToolbox(provider);
        this.keyLoader = new KeyknoxLoader(identity, this.toolbox);
    }

    async bootstrap(password?: string) {
        const publicKeys = await this.getPublicKeys(this.identity);
        const privateKey = await this.localBootstrap(publicKeys);
        console.log('privateKey', privateKey, publicKeys.length);
        if (privateKey) return;
        if (publicKeys.length > 0) {
            console.log('password', password);
            if (!password) {
                console.log('throw');
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

    async localBootstrap(publicKeys: VirgilPublicKey[]) {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) return null;
        if (publicKeys.length > 0) return privateKey;
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        await this.toolbox.createCard({ privateKey, publicKey });
        return privateKey;
    }

    async logout() {
        this.keyLoader.deleteKeys();
    }

    async encrypt(message: string, publicKeys: VirgilPublicKey[]) {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        const publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        return this.toolbox.virgilCrypto
            .encrypt(message, [publicKey, ...publicKeys] as VirgilPublicKey[])
            .toString('base64');
    }

    async decrypt(message: string) {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new BootstrapRequiredError();
        return this.toolbox.virgilCrypto
            .decrypt(message, privateKey as VirgilPrivateKey)
            .toString('utf8');
    }

    getPublicKeys(username: string) {
        return this.toolbox.getPublicKeys(username);
    }
}
