// eslint-disable @typescript-eslint/no-explicit-any
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { AbstractLevelDOWN } from 'abstract-leveldown';
import { ICard } from '../types';
import memdown from 'memdown';
import { VirgilCrypto } from 'virgil-crypto';
import { CachingJwtProvider, CardManager, KeyEntryStorage } from 'virgil-sdk';
import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { AbstractEThree } from '../AbstractEThree';
import {
    IdentityAlreadyExistsError,
    MultipleCardsError,
    RegisterRequiredError,
    UsersFoundWithMultipleCardsError,
    UsersNotFoundError,
} from '../errors';

use(chaiAsPromised);

const getRandomString = (prefix: string): string => {
    return `${prefix ? prefix : ''}${Math.random().toString(36).substr(2)}`;
};

let cryptoStub: sinon.SinonStubbedInstance<VirgilCrypto>;
let cardManagerStub: sinon.SinonStubbedInstance<CardManager>;
let keyLoaderStub: sinon.SinonStubbedInstance<PrivateKeyLoader>;
let accessTokenProviderStub: sinon.SinonStubbedInstance<CachingJwtProvider>;
let keyEntryStorageStub: sinon.SinonStubbedInstance<KeyEntryStorage>;
let groupStorageLeveldownStub: AbstractLevelDOWN;

class MyEThree extends AbstractEThree {
    constructor(identity: string) {
        super({
            identity,
            virgilCrypto: cryptoStub,
            cardManager: cardManagerStub,
            keyLoader: keyLoaderStub,
            groupStorageLeveldown: groupStorageLeveldownStub,
            // the following aren't actually used in the code and tests
            accessTokenProvider: accessTokenProviderStub,
            keyEntryStorage: keyEntryStorageStub,
        });
    }

    isPublicKey = sinon.fake();
}

beforeEach(() => {
    cryptoStub = sinon.createStubInstance(VirgilCrypto);
    cardManagerStub = sinon.createStubInstance(CardManager);
    keyLoaderStub = sinon.createStubInstance(PrivateKeyLoader);
    accessTokenProviderStub = sinon.createStubInstance(CachingJwtProvider);
    keyEntryStorageStub = sinon.createStubInstance(KeyEntryStorage);
    groupStorageLeveldownStub = memdown();
});

afterEach(() => {
    // Restore the default sandbox here
    sinon.restore();
});

describe('AbstractEthree', () => {
    describe('register', () => {
        it('throws IdentityAlreadyExistsError when identity already has card', async () => {
            const ethree = new MyEThree('my_identity');
            cardManagerStub.searchCards.resolves([{ identity: 'my_identity' } as ICard]);
            return expect(ethree.register()).eventually.rejectedWith(IdentityAlreadyExistsError);
        });
        it('throws MultipleCardsError when identity already has multiple cards', async () => {
            const ethree = new MyEThree('my_identity');
            cardManagerStub.searchCards.resolves([
                { identity: 'my_identity' } as ICard,
                { identity: 'my_identity' } as ICard,
            ]);
            return expect(ethree.register()).eventually.rejectedWith(MultipleCardsError);
        });
    });
    describe('unregister', () => {
        it('throws RegisterRequiredError when identity has no any cards', async () => {
            const ethree = new MyEThree('my_identity');
            cardManagerStub.searchCards.resolves([]);
            return expect(ethree.unregister()).eventually.rejectedWith(RegisterRequiredError);
        });
        it('revoke all cards for identity', async () => {
            const ethree = new MyEThree('my_identity');
            const identitiesCards = [
                { id: getRandomString(''), identity: 'my_identity' } as ICard,
                { id: getRandomString(''), identity: 'my_identity' } as ICard,
            ];
            cardManagerStub.searchCards.resolves(identitiesCards);
            await ethree.unregister();
            expect(cardManagerStub.revokeCard.callCount).to.eq(2);
            expect(cardManagerStub.revokeCard.firstCall.args[0]).to.eq(identitiesCards[0].id);
            expect(cardManagerStub.revokeCard.secondCall.args[0]).to.eq(identitiesCards[1].id);
        });
    });
    describe('findUsers', () => {
        it('throws when identities not provided', async () => {
            const ethree = new MyEThree('my_identity');
            expect(ethree.findUsers(undefined as any)).eventually.rejectedWith(TypeError);
            expect(ethree.findUsers(null as any)).eventually.rejectedWith(TypeError);
        });

        it('throws when identities is not an array or a string', async () => {
            const ethree = new MyEThree('my_identity');
            expect(ethree.findUsers({ not: 'valid' } as any)).eventually.rejectedWith(TypeError);
            expect(ethree.findUsers(42 as any)).eventually.rejectedWith(TypeError);
        });

        it('throws when identities array is empty', async () => {
            const ethree = new MyEThree('my_identity');
            expect(ethree.findUsers([])).eventually.rejectedWith(TypeError);
        });

        it('searches for cards in chunks of 50 identities at a time', async () => {
            const numberOfIdentities = 99;
            const identities = Array(numberOfIdentities)
                .fill(undefined)
                .map((_: undefined, index: number) => `identity_${index + 1}`);
            cardManagerStub.searchCards.callsFake((identities) => {
                if (Array.isArray(identities)) {
                    return Promise.resolve(identities.map((identity) => ({ identity } as ICard)));
                } else {
                    throw new Error('Expected "identities" to be an array');
                }
            });
            const ethree = new MyEThree('my_identity');
            const result = await ethree.findUsers(identities);
            expect(Object.values(result)).to.have.length(numberOfIdentities);
            expect(cardManagerStub.searchCards.callCount).to.eq(2);
            expect(cardManagerStub.searchCards.firstCall.args[0]).to.deep.eq(
                identities.slice(0, 50),
            );
            expect(cardManagerStub.searchCards.secondCall.args[0]).to.deep.eq(identities.slice(50));
        });

        it('throws if the Card is not found for an identity', () => {
            cardManagerStub.searchCards.resolves([{ identity: 'this_one_exists' } as ICard]);
            const ethree = new MyEThree('my_identity');
            return expect(
                ethree.findUsers(['this_one_exists', 'but_this_does_not']),
            ).eventually.rejectedWith(UsersNotFoundError);
        });

        it('throws if there are multiple cards for an identity', () => {
            cardManagerStub.searchCards.resolves([
                { identity: 'with_many_cards' } as ICard,
                { identity: 'with_many_cards' } as ICard,
            ]);
            const ethree = new MyEThree('my_identity');
            return expect(ethree.findUsers('with_many_cards')).eventually.rejectedWith(
                UsersFoundWithMultipleCardsError,
            );
        });
    });
});
