import PrivateKeyLoader from './PrivateKeyLoader';
import VirgilToolbox from './VirgilToolbox';
import { CachingJwtProvider, KeyEntryAlreadyExistsError } from 'virgil-sdk';
import { VirgilPublicKey, Data } from 'virgil-crypto';
import {
    RegisterRequiredError,
    EmptyArrayError,
    LookupError,
    IdentityAlreadyExistsError,
    MultithreadError,
    PrivateKeyAlreadyExistsError,
} from './errors';
import { isWithoutErrors, isArray, isString } from './utils/typeguards';
import { ICard } from 'virgil-sdk/dist/types/Cards/ICard';

type EncryptVirgilPublicKeyArg = VirgilPublicKey[] | VirgilPublicKey;

interface IEThreeOptions {
    provider: CachingJwtProvider;
    toolbox?: VirgilToolbox;
    keyLoader?: PrivateKeyLoader;
    card: ICard | null;
    hasPrivateKey: boolean;
}

export default class EThree {
    identity: string;
    card: ICard | null;
    toolbox: VirgilToolbox;
    hasPrivateKey: boolean = false;
    private keyLoader: PrivateKeyLoader;
    private inProcess: boolean = false;

    static async initialize(getToken: () => Promise<string>) {
        const provider = new CachingJwtProvider(getToken);
        const token = await provider.getToken({ operation: 'get' });
        const identity = token.identity();
        const toolbox = new VirgilToolbox(provider);
        const keyLoader = new PrivateKeyLoader(identity, toolbox);

        const [cards, privateKey] = await Promise.all([
            toolbox.cardManager.searchCards(identity),
            keyLoader.loadLocalPrivateKey(),
        ]);

        const card = cards.length > 0 ? cards[cards.length - 1] : null;
        const hasPrivateKey = Boolean(privateKey);

        return new EThree(identity, { provider, toolbox, keyLoader, card, hasPrivateKey });
    }

    constructor(identity: string, options: IEThreeOptions) {
        this.identity = identity;
        this.toolbox = options.toolbox || new VirgilToolbox(options.provider);
        this.keyLoader = options.keyLoader || new PrivateKeyLoader(this.identity, this.toolbox);
        this.card = options.card;
        this.hasPrivateKey = options.hasPrivateKey;
    }

    get isRegistered(): boolean {
        return Boolean(this.card);
    }

    async register() {
        if (this.inProcess) throw new MultithreadError(this.register.name);
        this.inProcess = true;
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (privateKey) return;
        if (!privateKey && this.card) throw new IdentityAlreadyExistsError();
        const keyPair = this.toolbox.virgilCrypto.generateKeys();
        const { card } = await this.toolbox.publishCard(keyPair);
        this.card = card;
        this.hasPrivateKey = true;
        await this.keyLoader.savePrivateKeyLocal(keyPair.privateKey);
        this.inProcess = false;
        return privateKey;
    }

    async rotatePrivateKey(): Promise<void> {
        if (this.inProcess) throw new MultithreadError(this.register.name);
        this.inProcess = true;
        if (!this.card) throw new RegisterRequiredError();
        if (this.hasPrivateKey) await this.keyLoader.resetLocalPrivateKey();
        const keyPair = this.toolbox.virgilCrypto.generateKeys();
        const { card } = await this.toolbox.publishCard(keyPair, this.card.id);
        this.card = card;
        await this.keyLoader.savePrivateKeyLocal(keyPair.privateKey);
        this.inProcess = false;
    }

    async restorePrivateKey(pwd: string): Promise<void> {
        try {
            await this.keyLoader.loadRemotePrivateKey(pwd);
        } catch (e) {
            if (e instanceof KeyEntryAlreadyExistsError) {
                throw new PrivateKeyAlreadyExistsError();
            }
            throw e;
        }
    }

    async cleanup() {
        return await this.keyLoader.resetLocalPrivateKey();
    }

    async resetPrivateKeyBackup(password: string) {
        return this.keyLoader.resetBackupPrivateKey(password);
    }

    async encrypt(message: string, publicKeys?: EncryptVirgilPublicKeyArg): Promise<string>;
    async encrypt(message: Buffer, publicKey?: EncryptVirgilPublicKeyArg): Promise<Buffer>;
    async encrypt(message: ArrayBuffer, publicKey?: EncryptVirgilPublicKeyArg): Promise<Buffer>;
    async encrypt(message: Data, publicKeys?: EncryptVirgilPublicKeyArg): Promise<Buffer | string> {
        const isString = typeof message === 'string';

        if (publicKeys && isArray(publicKeys) && publicKeys.length === 0) {
            throw new EmptyArrayError('encrypt');
        }

        let argument: VirgilPublicKey[];

        if (publicKeys == null) argument = [];
        else if (isArray(publicKeys)) argument = publicKeys;
        else argument = [publicKeys];

        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();

        argument.push(this.toolbox.virgilCrypto.extractPublicKey(privateKey));

        let res: Data = this.toolbox.virgilCrypto.signThenEncrypt(message, privateKey, argument);
        if (isString) res = res.toString('base64');
        return res;
    }

    async decrypt(message: string, publicKey?: VirgilPublicKey): Promise<string>;
    async decrypt(message: Buffer, publicKey?: VirgilPublicKey): Promise<Buffer>;
    async decrypt(message: ArrayBuffer, publicKey?: VirgilPublicKey): Promise<Buffer>;
    async decrypt(message: Data, publicKey?: VirgilPublicKey): Promise<Buffer | string> {
        const isMessageString = isString(message);
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        if (!publicKey) publicKey = this.toolbox.virgilCrypto.extractPublicKey(privateKey);
        let res: Data = this.toolbox.virgilCrypto.decryptThenVerify(message, privateKey, publicKey);
        if (isMessageString) return res.toString('utf8') as string;
        return res as Buffer;
    }

    async lookupPublicKeys(identities: string): Promise<VirgilPublicKey>;
    async lookupPublicKeys(identities: string[]): Promise<VirgilPublicKey[]>;
    async lookupPublicKeys(
        identities: string[] | string,
    ): Promise<VirgilPublicKey[] | VirgilPublicKey> {
        const argument = isArray(identities) ? identities : [identities];

        if (argument.length === 0) throw new EmptyArrayError('lookupPublicKeys');

        const responses = await Promise.all(
            argument.map(i =>
                this.toolbox
                    .getPublicKey(i)
                    .catch(e => Promise.resolve(e instanceof Error ? e : new Error(e))),
            ),
        );

        if (isWithoutErrors(responses)) return isArray(identities) ? responses : responses[0];

        return Promise.reject(new LookupError(responses));
    }

    async changePassword(oldPwd: string, newPwd: string) {
        return await this.keyLoader.changePassword(newPwd);
    }

    async backupPrivateKey(pwd: string): Promise<void> {
        const privateKey = await this.keyLoader.loadLocalPrivateKey();
        if (!privateKey) throw new RegisterRequiredError();
        await this.keyLoader.savePrivateKeyRemote(privateKey, pwd);
        return;
    }
}
