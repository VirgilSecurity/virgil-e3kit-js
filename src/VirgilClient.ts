import {
    VirgilPrivateKey,
    VirgilPublicKey,
    VirgilCrypto,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';

export class EncryptionClient {
    constructor(
        private privateKey: VirgilPrivateKey,
        private publicKey: VirgilPublicKey[],
        private virgilCrypto: VirgilCrypto,
    ) {}

    encrypt(message: string, publicKeys: VirgilPublicKey[]) {
        const encryptedData = this.virgilCrypto.encrypt(
            message,
            // encrypted public keys of sender are added to add possibility to decrypt
            // message from other device
            [...publicKeys, ...this.publicKey] as VirgilPublicKey[],
        );

        return encryptedData.toString('base64');
    }

    decrypt(message: string) {
        const decryptedData = this.virgilCrypto.decrypt(message, this.privateKey);
        return decryptedData.toString('utf8');
    }
}
