import { Device } from './device';

const aliceDevice = new Device('Alice');
const bobDevice = new Device('Bob');

document.body.innerHTML = 'All magic in the code and results are in console';

Promise.all([
    aliceDevice.initialize(),
    bobDevice.initialize()
]).then(async ([aliceEThreeKit, bobEThreeKit]) => {
    const aliceHasKey = await aliceEThreeKit.hasLocalPrivateKey();
    const bobHasKey = await bobEThreeKit.hasLocalPrivateKey();
    if (!aliceHasKey) {
        await aliceEThreeKit.register();
        await aliceDevice.eThree.backupPrivateKey('MySuperSecurePassword');
    }
    if (!bobHasKey) await bobEThreeKit.register();
}).then(async () => {
    const encryptedMessage = await aliceDevice.encryptMessage('Bob', 'Hi, Bob, How are you?');
    console.log('encryptedMessage', encryptedMessage);

    const decryptedMessage = await bobDevice.decryptMessage('Alice', encryptedMessage);
    console.log('decryptedMessage', decryptedMessage);
}).then(async () => {
    await aliceDevice.eThree.cleanup();
    console.log('Has Alice local private key', await aliceDevice.eThree.hasLocalPrivateKey())
    await aliceDevice.login('MySuperSecurePassword')
}).then(async () => {
    console.log('Has Alice local private key after restore', await aliceDevice.eThree.hasLocalPrivateKey())
})
