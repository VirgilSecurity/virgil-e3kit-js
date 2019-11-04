const http = require('http');
const querystring = require('querystring');

const { EThree } = require('@virgilsecurity/e3kit-node');
const dotenv = require('dotenv');

console.log('Virgil E3Kit SDK + Node.js usage example');
console.log('If all goes well, you should see messages printed below in a moment...');

dotenv.config();
const API_URL = process.env.API_URL || 'http://localhost:3000';

const getJson = url =>
    new Promise((resolve, reject) => {
        const request = http.get(url, response => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(JSON.parse(data));
            });
        });
        request.on('error', error => {
            reject(error);
        });
    });

const createGetToken = identity => async () => {
    const query = querystring.stringify({ identity });
    const { virgil_jwt: virgilJwt } = await getJson(`${API_URL}/virgil-jwt?${query}`);
    return virgilJwt;
};

(async () => {
    try {
        const alice = await EThree.initialize(createGetToken('alice'), {
            apiUrl: process.env.VIRGIL_API_URL,
        });
        const bob = await EThree.initialize(createGetToken('bob'), {
            apiUrl: process.env.VIRGIL_API_URL,
        });

        console.log('Alice registers...');
        await alice.register();

        console.log('Alice creates private key backup...');
        await alice.backupPrivateKey('alice_pa$$w0rd');

        console.log('Bob registers...');
        await bob.register();

        console.log('Bob creates private key backup...');
        await bob.backupPrivateKey('bob_pa$$w0rd');

        console.log("Alice searches for Bob's card...");
        const bobCard = await alice.findUsers(bob.identity);

        console.log('Alice encrypts message for Bob...');
        const encryptedForBob = await alice.encrypt('Hello Bob!', bobCard);

        console.log("Bob searches for Alice's card...");
        const aliceCard = await bob.findUsers(alice.identity);

        console.log('Bob decrypts the message...');
        const decryptedByBob = await bob.decrypt(encryptedForBob, aliceCard);

        console.log('Decrypted message: ' + decryptedByBob);

        const groupId = 'AliceAndBobGroup';

        console.log('Alice creates a group with Bob...');
        const aliceGroup = await alice.createGroup(groupId, bobCard);

        console.log('Alice encrypts message for the group...');
        const encryptedForGroup = await aliceGroup.encrypt('Hello group!');

        console.log('Bob loads the group by ID from the Cloud...');
        const bobGroup = await bob.loadGroup(groupId, aliceCard);

        console.log('Bob decrypts the group message...');
        const decryptedByGroup = await bobGroup.decrypt(encryptedForGroup, aliceCard);

        console.log('Decrypted group message: ' + decryptedByGroup);

        console.log('Alice deletes group...');
        await alice.deleteGroup(groupId);

        console.log('Alice deletes private key backup...');
        await alice.resetPrivateKeyBackup('alice_pa$$w0rd');

        console.log('Alice unregisters...');
        await alice.unregister();

        console.log('Bob deletes private key backup...');
        await bob.resetPrivateKeyBackup('bob_pa$$w0rd');

        console.log('Bob unregisters...');
        await bob.unregister();
    } catch (error) {
        console.log(error.toString());
    }
})();
