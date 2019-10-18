// eslint-disable @typescript-eslint/no-explicit-any
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import { CardManager, CachingJwtProvider, KeyEntryStorage, ICard } from 'virgil-sdk';
import { VirgilCrypto } from '@virgilsecurity/base-crypto';
import { PrivateKeyLoader } from '../PrivateKeyLoader';
import { AbstractEThree } from '../AbstractEThree';
import { UsersNotFoundError, UsersFoundWithMultipleCardsError } from '../errors';
import { GroupLocalStorage } from '../GroupLocalStorage';

use(chaiAsPromised);

let virgilCryptoStub: sinon.SinonStubbedInstance<VirgilCrypto>;
let cardManagerStub: sinon.SinonStubbedInstance<CardManager>;
let keyLoaderStub: sinon.SinonStubbedInstance<PrivateKeyLoader>;
let accessTokenProviderStub: sinon.SinonStubbedInstance<CachingJwtProvider>;
let keyEntryStorageStub: sinon.SinonStubbedInstance<KeyEntryStorage>;
let groupLocalStorageStub: sinon.SinonStubbedInstance<GroupLocalStorage>;

class MyEThree extends AbstractEThree {
    constructor(identity: string) {
        super({
            identity,
            virgilCrypto: virgilCryptoStub,
            cardManager: cardManagerStub as any,
            keyLoader: keyLoaderStub as any,
            groupLocalStorage: groupLocalStorageStub as any,
            // the following aren't actually used in the code and tests
            accessTokenProvider: accessTokenProviderStub,
            keyEntryStorage: keyEntryStorageStub,
        });
    }

    isPublicKey = sinon.fake();
}

beforeEach(() => {
    virgilCryptoStub = sinon.createStubInstance(VirgilCrypto);
    cardManagerStub = sinon.createStubInstance(CardManager);
    keyLoaderStub = sinon.createStubInstance(PrivateKeyLoader);
    accessTokenProviderStub = sinon.createStubInstance(CachingJwtProvider);
    keyEntryStorageStub = sinon.createStubInstance(KeyEntryStorage);
    groupLocalStorageStub = sinon.createStubInstance(GroupLocalStorage);
});

afterEach(() => {
    // Restore the default sandbox here
    sinon.restore();
});

describe('AbstractEthree', () => {
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
            cardManagerStub.searchCards.callsFake(identities => {
                if (Array.isArray(identities)) {
                    return Promise.resolve(identities.map(identity => ({ identity } as ICard)));
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

            expect(
                ethree.findUsers(['this_one_exists', 'but_this_does_not']),
            ).eventually.rejectedWith(UsersNotFoundError);
        });

        it('throws if there are multiple cards for an identity', () => {
            cardManagerStub.searchCards.resolves([
                { identity: 'with_many_cards' } as ICard,
                { identity: 'with_many_cards' } as ICard,
            ]);
            const ethree = new MyEThree('my_identity');
            expect(ethree.findUsers('with_many_cards')).eventually.rejectedWith(
                UsersFoundWithMultipleCardsError,
            );
        });
    });
});
