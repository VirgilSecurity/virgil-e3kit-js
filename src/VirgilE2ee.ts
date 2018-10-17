import KeyknoxLoader from './KeyknoxLoader';
import VirgilToolbox from './virgilToolbox';
import { Jwt, CachingJwtProvider } from 'virgil-sdk';
import { VirgilPublicKey, VirgilPrivateKey } from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import { BootstrapRequiredError } from './errors';

export default class VirgilE2ee {
    identity: string;
    private keyLoader: KeyknoxLoader;
    private toolbox: VirgilToolbox;

    static async init(getToken: () => Promise<string>) {
        const provider = new CachingJwtProvider(getToken);
        const token = await provider.getToken({ operation: 'get' });
        const identity = token.identity();
        return new VirgilE2ee(identity, provider);
    }

    constructor(identity: string, provider: CachingJwtProvider) {
        this.identity = identity;
        this.toolbox = new VirgilToolbox(provider);
        this.keyLoader = new KeyknoxLoader(identity, this.toolbox);
    }

    async bootstrap(password?: string) {
        let [privateKey, publicKeys] = await Promise.all([
            this.keyLoader.loadPrivateKey(password),
            this.toolbox.getPublicKeys(this.identity),
        ]);
        console.log('this.identity', this.identity, privateKey);
        let publicKey: VirgilPublicKey;

        if (privateKey) {
            if (publicKeys.length > 0) {
                return;
            } else {
                publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
                await this.toolbox.createCard({ privateKey, publicKey });
                return;
            }
        } else {
            if (publicKeys.length > 0) {
                throw new Error('private key not found');
            } else {
                const keyPair = this.toolbox.virgilCrypto.generateKeys();
                publicKey = keyPair.publicKey;
                privateKey = keyPair.privateKey;
                await this.toolbox.createCard({ privateKey, publicKey });
                await this.keyLoader.savePrivateKey(privateKey, password!);
            }
            return;
        }
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
