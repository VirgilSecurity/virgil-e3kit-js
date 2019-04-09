import { EThree } from '@virgilsecurity/e3kit';
import { authenticate, getVirgilToken } from './snippets';

export class Device {

    constructor(identity) {
        this.identity = identity;
    }

    async initialize() {
        const authToken = await authenticate(this.identity);
        this.eThree = await EThree.initialize(() => getVirgilToken(authToken));
        return this.eThree;
    }

    async login(pwd) {
        const eThree = await this.initialize();
        const hasPrivateKey = await eThree.hasLocalPrivateKey();
        if (!hasPrivateKey) await eThree.restorePrivateKey(pwd);
    }

    async register() {
        const eThree = await this.initialize();
        await eThree.register();
        return this.eThree;
    }

    async encryptMessage(receiverIdentity, message) {
        const eThree = await this.eThree;
        const publicKeys = await eThree.lookupPublicKeys(receiverIdentity);
        const encryptedMessage = await eThree.encrypt(message, publicKeys);
        return encryptedMessage;
    }

    async decryptMessage(senderIdentity, encryptedMessage) {
        const eThree = await this.eThree;
        const publicKey = await eThree.lookupPublicKeys(senderIdentity);
        const decryptedMessage = await eThree.decrypt(encryptedMessage, publicKey);
        return decryptedMessage;
    }
}

