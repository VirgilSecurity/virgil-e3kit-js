import { VirgilCrypto, VirgilCardCrypto, VirgilPrivateKey } from 'virgil-crypto';
import { VirgilPublicKey } from 'virgil-crypto';
import { VirgilCardVerifier, CachingJwtProvider, CardManager } from 'virgil-sdk';
import { LookupNotFoundError, MultipleCardsError } from './errors';

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

        this.getPublicKey = this.getPublicKey.bind(this);
    }

    async publishCard(keyPair: IKeyPair, previousCardId?: string) {
        const card = await this.cardManager.publishCard({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
            previousCardId,
        });

        return { keyPair, card };
    }

    async getPublicKey(identity: string): Promise<VirgilPublicKey> {
        const cards = await this.cardManager.searchCards(identity);
        if (!cards.length) throw new LookupNotFoundError(identity);
        const publicKeys = cards.map(card => card.publicKey as VirgilPublicKey);
        if (publicKeys.length > 1) {
            throw new MultipleCardsError(identity);
        }
        return publicKeys[0] as VirgilPublicKey;
    }
}
