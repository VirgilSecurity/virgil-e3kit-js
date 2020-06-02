import { expect } from 'chai';
import uuid from 'uuid/v4';

import { EThree, GroupError } from '@virgilsecurity/e3kit-node';
import { initPythia } from '@virgilsecurity/pythia-crypto';
import { initCrypto, VirgilAccessTokenSigner, VirgilCrypto, KeyPairType } from 'virgil-crypto';
import { JwtGenerator } from 'virgil-sdk';

import { sleep } from './utils';

type ICard = import('virgil-sdk').ICard;

describe('EThree', () => {
    let virgilCrypto: VirgilCrypto;
    let jwtGenerator: JwtGenerator;

    before(async () => {
        await Promise.all([initCrypto(), initPythia()]);
    });

    beforeEach(() => {
        virgilCrypto = new VirgilCrypto();
        jwtGenerator = new JwtGenerator({
            appId: process.env.APP_ID!,
            apiKeyId: process.env.APP_KEY_ID!,
            apiKey: virgilCrypto.importPrivateKey(process.env.APP_KEY!),
            accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
        });
    });

    const createFetchToken = (identity: string) => () =>
        Promise.resolve(jwtGenerator.generateToken(identity).toString());

    const initializeEThree = (fetchToken: () => Promise<string>) =>
        EThree.initialize(fetchToken, {
            apiUrl: process.env.API_URL,
            groupStorageName: `.virgil-group-storage/${uuid()}`,
            keyPairType: KeyPairType.ED25519,
        });

    describe('group encryption', () => {
        const createEThree = async (identity?: string) => {
            const myIdentity = identity || uuid();
            const ethree = await initializeEThree(createFetchToken(myIdentity));
            await ethree.register();
            return ethree;
        };

        it('can create, share and load group to encrypt / decrypt messages', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const bobAndCharlesCards = await aliceEThree.findUsers([
                bobEThree.identity,
                charlesEThree.identity,
            ]);
            const groupId = uuid();

            const aliceGroup = await aliceEThree.createGroup(groupId, bobAndCharlesCards);
            expect(aliceGroup).to.be.ok;

            const message = 'Hello everyone! This is the beginning of our group chat!';
            const encryptedMessage = await aliceGroup.encrypt(message);

            const aliceCardForBob = await bobEThree.findUsers(aliceEThree.identity);
            const bobGroup = await bobEThree.loadGroup(groupId, aliceCardForBob);
            const decryptedMessageForBob = await bobGroup.decrypt(
                encryptedMessage,
                aliceCardForBob,
            );
            expect(decryptedMessageForBob.toString('utf8')).to.eq(message);

            const aliceCardForCharles = await charlesEThree.findUsers(aliceEThree.identity);
            const charlesGroup = await charlesEThree.loadGroup(groupId, aliceCardForCharles);
            const decryptedMessageForCharles = await charlesGroup.decrypt(
                encryptedMessage,
                aliceCardForCharles,
            );
            expect(decryptedMessageForCharles.toString('utf8')).to.eq(message);
        });

        it('STE-26 `createGroup` throws if trying to pass invalid participants count', async () => {
            const aliceEThree = await createEThree();
            const groupId = uuid();
            const aliceCard = await aliceEThree.findUsers(aliceEThree.identity);
            const findUserResults: { [key: string]: ICard } = {};
            for (let i = 0; i < 100; i += 1) {
                findUserResults[uuid()] = aliceCard;
            }
            try {
                await aliceEThree.createGroup(groupId, findUserResults);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const newUsers: { [key: string]: ICard } = {};
            newUsers[uuid()] = aliceCard;
            const group = await aliceEThree.createGroup(groupId, newUsers);
            expect(group.participants).to.have.length(2);
            expect(group.participants).to.include(aliceEThree.identity);
        });

        it('STE-27 `createGroup` adds founder to the list of participants', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            const group = await aliceEThree.createGroup(groupId, bobCard);
            const participants = new Set(group.participants);
            expect(participants).to.have.length(2);
            expect(participants.has(aliceEThree.identity)).to.be.true;
            expect(participants.has(bobEThree.identity)).to.be.true;
        });

        it('STE-28 `createGroup` throws if `groupId` is too small', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            try {
                await aliceEThree.createGroup({ value: '', encoding: 'utf8' }, bobCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });

        it('STE-29 `getGroup`', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            const groupId = uuid();
            const aliceGroup = await aliceEThree.createGroup(groupId, bobCard);
            const group = await aliceEThree.getGroup(groupId);
            expect(group).not.to.be.null;
            expect(group!.initiator).to.equal(aliceGroup.initiator);
            expect(new Set(group!.participants)).to.eql(new Set(aliceGroup.participants));
        });

        it('STE-30 `loadGroup`', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const aliceGroupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            const aliceGroup = await aliceEThree.createGroup(aliceGroupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const loadedGroup = await bobEThree.loadGroup(aliceGroupId, aliceCard);
            expect(loadedGroup.initiator).to.equal(aliceGroup.initiator);
            expect(new Set(loadedGroup.participants)).to.eql(new Set(aliceGroup.participants));
        });

        it('STE-31 `loadGroup` throws if trying to load non-existent group', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const groupId = uuid();
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            try {
                await bobEThree.loadGroup(groupId, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const charlesCard = await aliceEThree.findUsers(charlesEThree.identity);
            await aliceEThree.createGroup(groupId, charlesCard);
            try {
                await bobEThree.loadGroup(groupId, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
        });

        it('STE-32 throws if trying to perform actions on deleted group', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            await aliceEThree.createGroup(groupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group = await bobEThree.loadGroup(groupId, aliceCard);
            await aliceEThree.deleteGroup(groupId);
            const group1 = await aliceEThree.getGroup(groupId);
            expect(group1).to.be.null;
            try {
                await aliceEThree.loadGroup(groupId, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            try {
                await group.update();
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            try {
                await bobEThree.loadGroup(groupId, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const group2 = await bobEThree.getGroup(groupId);
            expect(group2).to.be.null;
        });

        it('STE-34 `remove` throws if trying to remove last participant', async () => {
            const aliceEThree = await createEThree();
            const aliceCard = await aliceEThree.findUsers(aliceEThree.identity);
            const group = await aliceEThree.createGroup(uuid());
            try {
                await group.remove(aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
        });

        it('STE-35 `remove`', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const groupId = uuid();
            const bobAndCharlesCards = await aliceEThree.findUsers([
                bobEThree.identity,
                charlesEThree.identity,
            ]);
            const group1 = await aliceEThree.createGroup(groupId, bobAndCharlesCards);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            const group3 = await charlesEThree.loadGroup(groupId, aliceCard);
            await group1.remove(bobAndCharlesCards[bobEThree.identity]);
            expect(new Set(group1.participants).has(bobEThree.identity)).to.be.false;
            await group3.update();
            expect(new Set(group3.participants).has(bobEThree.identity)).to.be.false;
            try {
                await group2.update();
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            try {
                await bobEThree.loadGroup(groupId, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const group = await bobEThree.getGroup(groupId);
            expect(group).to.be.null;
        });

        it('STE-36 throws if user has no rights to manage a group', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const steveEThree = await createEThree();
            const groupId = uuid();
            const bobAndCharlesCards = await aliceEThree.findUsers([
                bobEThree.identity,
                charlesEThree.identity,
            ]);
            await aliceEThree.createGroup(groupId, bobAndCharlesCards);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group = await bobEThree.loadGroup(groupId, aliceCard);
            try {
                await group.remove(bobAndCharlesCards[charlesEThree.identity]);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            try {
                const steveCard = await bobEThree.findUsers(steveEThree.identity);
                await group.add(steveCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
        });

        it('STE-37 `add`', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            const group1 = await aliceEThree.createGroup(groupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            const charlesCard = await bobEThree.findUsers(charlesEThree.identity);
            await group1.add(charlesCard);
            await group2.update();
            const group3 = await charlesEThree.loadGroup(groupId, aliceCard);
            const participants = new Set([
                aliceCard.identity,
                bobCard.identity,
                charlesCard.identity,
            ]);
            expect(new Set(group1.participants)).to.eql(participants);
            expect(new Set(group2.participants)).to.eql(participants);
            expect(new Set(group3.participants)).to.eql(participants);
        });

        it('STE-38 `decrypt` throws if called with an old card', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            await aliceEThree.createGroup(groupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            await bobEThree.cleanup();
            await bobEThree.rotatePrivateKey();
            const encryptedData = await group2.encrypt({ value: 'message', encoding: 'utf8' });
            try {
                await group2.decrypt(encryptedData, bobCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
        });

        it('STE-39 `encrypt` => `decrypt`', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const groupId = uuid();
            const cards = await aliceEThree.findUsers([
                aliceEThree.identity,
                bobEThree.identity,
                charlesEThree.identity,
            ]);

            const group1 = await aliceEThree.createGroup(groupId, cards[bobEThree.identity]);
            const message1 = 'message1';
            const encryptedData1 = await group1.encrypt(message1);
            const aliceDecryptedData1 = await group1.decrypt(
                encryptedData1,
                cards[aliceEThree.identity],
            );
            expect(aliceDecryptedData1.toString('utf8')).to.equal(message1);

            const group2 = await bobEThree.loadGroup(groupId, cards[aliceEThree.identity]);
            const bobDecryptedData1 = await group2.decrypt(
                encryptedData1,
                cards[aliceEThree.identity],
            );
            expect(bobDecryptedData1.toString('utf8')).to.equal(message1);

            await group1.add(cards[charlesEThree.identity]);
            const message2 = 'message2';
            const encryptedData2 = await group1.encrypt(message2);
            const aliceDecryptedData2 = await group1.decrypt(
                encryptedData2,
                cards[aliceEThree.identity],
            );
            expect(aliceDecryptedData2.toString('utf8')).to.equal(message2);

            await group2.update();
            const group3 = await charlesEThree.loadGroup(groupId, cards[aliceEThree.identity]);
            const bobDecryptedData2 = await group2.decrypt(
                encryptedData2,
                cards[aliceEThree.identity],
            );
            const charlesDecryptedData2 = await group3.decrypt(
                encryptedData2,
                cards[aliceEThree.identity],
            );
            expect(bobDecryptedData2.toString('utf8')).to.equal(message2);
            expect(charlesDecryptedData2.toString('utf8')).to.equal(message2);

            await group1.remove(cards[bobEThree.identity]);
            const message3 = 'message3';
            const encryptedData3 = await group1.encrypt(message3);
            const aliceDecryptedData3 = await group1.decrypt(
                encryptedData3,
                cards[aliceEThree.identity],
            );
            expect(aliceDecryptedData3.toString('utf8')).to.equal(message3);

            try {
                await group2.decrypt(encryptedData3, cards[aliceEThree.identity]);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }

            await group3.update();
            const charlesDecryptedData3 = await group3.decrypt(
                encryptedData3,
                cards[aliceEThree.identity],
            );
            expect(charlesDecryptedData3.toString('utf8')).to.equal(message3);

            await charlesEThree.cleanup();
            await charlesEThree.rotatePrivateKey();

            try {
                await group3.update();
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const group4 = await charlesEThree.getGroup(groupId);
            expect(group4).to.be.null;

            try {
                await charlesEThree.loadGroup(groupId, cards[aliceEThree.identity]);
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }

            const message4 = 'message4';
            const encryptedData4 = await group1.encrypt(message4);

            const charlesCard = await charlesEThree.findUsers(charlesEThree.identity);
            await group1.reAdd(charlesCard);
            const group5 = await charlesEThree.loadGroup(groupId, cards[aliceEThree.identity]);
            const charlesDecryptedData4 = await group5.decrypt(
                encryptedData4,
                cards[aliceEThree.identity],
            );
            expect(charlesDecryptedData4.toString('utf8')).to.equal(message4);
        });

        it('STE-42 `decrypt` throws if called by an old group', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const charlesEThree = await createEThree();
            const groupId = uuid();
            const bobAndCharlesCards = await aliceEThree.findUsers([
                bobEThree.identity,
                charlesEThree.identity,
            ]);
            const group1 = await aliceEThree.createGroup(groupId, bobAndCharlesCards);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            await group1.remove(bobAndCharlesCards[charlesEThree.identity]);
            const encryptedData = await group1.encrypt({ value: 'message', encoding: 'utf8' });
            try {
                await group2.decrypt(encryptedData, aliceCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
        });

        it('STE-43 `decrypt` throws if called by an old group', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            const group1 = await aliceEThree.createGroup(groupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            const date1 = new Date();
            const message1 = 'message1';
            const encryptedData1 = await group2.encrypt(message1);
            await sleep(1000);
            await bobEThree.cleanup();
            await bobEThree.rotatePrivateKey();
            const date2 = new Date();
            const message2 = 'message2';
            const encryptedData2 = await group2.encrypt(message2);
            const newBobCard = await aliceEThree.findUsers(bobEThree.identity);
            try {
                await group1.decrypt(encryptedData1, newBobCard);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            try {
                await group1.decrypt(encryptedData1, newBobCard, date2);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const decryptedData1 = await group1.decrypt(encryptedData1, newBobCard, date1);
            expect(decryptedData1.toString('utf8')).to.equal(message1);
            try {
                await group2.decrypt(encryptedData2, newBobCard, date1);
                expect.fail();
            } catch (error) {
                expect(error).to.be.instanceOf(GroupError);
            }
            const decryptedData2 = await group1.decrypt(encryptedData2, newBobCard, date2);
            expect(decryptedData2.toString('utf8')).to.equal(message2);
        });

        it('STE-46', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            await aliceEThree.createGroup(groupId, bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            await bobEThree.loadGroup(groupId, aliceCard);
            await aliceEThree.getGroup(groupId);
            await bobEThree.getGroup(groupId);
            await aliceEThree.deleteGroup(groupId);
        });

        it('STE-73', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const group1 = await aliceEThree.createGroup(groupId);
            const message = 'message';
            const encrypted = await group1.encrypt(message);
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            await group1.add(bobCard);
            const aliceCard = await bobEThree.findUsers(aliceEThree.identity);
            const group2 = await bobEThree.loadGroup(groupId, aliceCard);
            const decrypted = await group2.decrypt(encrypted, aliceCard);
            expect(decrypted.toString('utf8')).to.equal(message);
        });

        it('STE-85', async () => {
            const aliceEThree = await createEThree();
            const groupId = uuid();
            try {
                await aliceEThree.deleteGroup(groupId);
            } catch (_) {
                expect.fail();
            }
        });

        it('STE-86', async () => {
            const aliceEThree = await createEThree();
            const bobEThree = await createEThree();
            const groupId = uuid();
            const group = await aliceEThree.createGroup(groupId);
            const bobCard = await aliceEThree.findUsers(bobEThree.identity);
            await group.add(bobCard);
            const localGroup = await aliceEThree.getGroup(groupId);
            const participants = new Set(localGroup!.participants);
            expect(participants.size).to.equal(2);
            expect(participants.has(aliceEThree.identity)).to.be.true;
            expect(participants.has(bobEThree.identity)).to.be.true;
        });
    });
});
