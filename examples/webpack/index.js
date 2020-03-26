import { EThree } from '@virgilsecurity/e3kit-browser';

const createGetToken = identity => async () => {
    const response = await fetch(`${process.env.API_URL}/virgil-jwt?identity=${identity}`);
    const { virgil_jwt: virgilJwt } = await response.json();
    return virgilJwt;
};

const report = message => {
    const paragraph = document.createElement('p');
    const textNode = document.createTextNode(message);
    paragraph.appendChild(textNode);
    document.body.appendChild(paragraph);
};

(async () => {
    try {
        const alice = await EThree.initialize(createGetToken(`alice-${Math.random()}`));
        const bob = await EThree.initialize(createGetToken(`bob-${Math.random()}`));

        report('Alice registers...');
        await alice.register();

        report('Alice creates private key backup...');
        await alice.backupPrivateKey('alice_pa$$w0rd');

        report('Bob registers...');
        await bob.register();

        report('Bob creates private key backup...');
        await bob.backupPrivateKey('bob_pa$$w0rd');

        report("Alice searches for Bob's card...");
        const bobCard = await alice.findUsers(bob.identity);

        report('Alice encrypts message for Bob...');
        const encryptedForBob = await alice.encrypt('Hello Bob!', bobCard);

        report("Bob searches for Alice's card...");
        const aliceCard = await bob.findUsers(alice.identity);

        report('Bob decrypts the message...');
        const decryptedByBob = await bob.decrypt(encryptedForBob, aliceCard);

        report('Decrypted message: ' + decryptedByBob);

        const groupId = 'AliceAndBobGroup';

        report('Alice creates a group with Bob...');
        const aliceGroup = await alice.createGroup(groupId, bobCard);

        report('Alice encrypts message for the group...');
        const encryptedForGroup = await aliceGroup.encrypt('Hello group!');

        report('Bob loads the group by ID from the Cloud...');
        const bobGroup = await bob.loadGroup(groupId, aliceCard);

        report('Bob decrypts the group message...');
        const decryptedByGroup = await bobGroup.decrypt(encryptedForGroup, aliceCard);

        report('Decrypted group message: ' + decryptedByGroup);

        report('Alice deletes group...');
        await alice.deleteGroup(groupId);

        report('Alice deletes private key backup...');
        await alice.resetPrivateKeyBackup('alice_pa$$w0rd');

        report('Alice unregisters...');
        await alice.unregister();

        report('Bob deletes private key backup...');
        await bob.resetPrivateKeyBackup('bob_pa$$w0rd');

        report('Bob unregisters...');
        await bob.unregister();
    } catch (error) {
        report(error.toString());
    }
})();
