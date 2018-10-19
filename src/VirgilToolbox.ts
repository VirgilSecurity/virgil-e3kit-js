import {
    VirgilCrypto,
    VirgilCardCrypto,
    VirgilPrivateKey,
} from 'virgil-crypto/dist/virgil-crypto-pythia.cjs';
import { VirgilPublicKey, VirgilPrivateKeyExporter } from 'virgil-crypto';
import { VirgilCardVerifier, CachingJwtProvider, CardManager } from 'virgil-sdk';

export interface IKeyPair {
    privateKey: VirgilPrivateKey;
    publicKey: VirgilPublicKey;
}

export default class VirgilToolbox {
    virgilCrypto = new VirgilCrypto();
    cardCrypto = new VirgilCardCrypto(this.virgilCrypto);
    cardVerifier = new VirgilCardVerifier(this.cardCrypto);
    cardManager: CardManager;
    jwtProvider: CachingJwtProvider;

    constructor(provider: CachingJwtProvider) {
        this.jwtProvider = provider;

        this.cardManager = new CardManager({
            cardCrypto: this.cardCrypto,
            cardVerifier: this.cardVerifier,
            accessTokenProvider: this.jwtProvider,
            retryOnUnauthorized: true,
        });
    }

    async createCard(keyPair: IKeyPair) {
        await this.cardManager.publishCard({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
        });

        return keyPair;
    }

    getPublicKeys = async (identity: string) => {
        const cards = await this.cardManager.searchCards(identity);
        try {
            const publicKeys = cards.map(card => card.publicKey as VirgilPublicKey);
            return publicKeys;
        } catch (e) {
            return e;
        }
    };
}
