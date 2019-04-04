import eThree from './snippets';

let sdk;

eThree.then(client => sdk = client)
.then(() => sdk.hasLocalPrivateKey())
.then(() => sdk.register())
.then(() => sdk.encrypt('success!'))
.then((encryptedMessage) => sdk.decrypt(encryptedMessage))
.then((message) => alert(message))
.then(() => sdk.cleanup())
.catch((error) => {
    console.error(error)
});
