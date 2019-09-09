import { EThree } from '@virgilsecurity/e3kit';

const getToken = () => fetch('http://localhost:3000/get-virgil-jwt/')
    .then(res => res.json())
    .then(data =>  data.token);

let sdk;

EThree.initialize(getToken)
    .then(client => sdk = client)
    .then(() => sdk.register())
    .then(() => sdk.backupPrivateKey('pa$$w0rd'))
    .then(() => sdk.encrypt('success!'))
    .then((encryptedMessage) => sdk.decrypt(encryptedMessage))
    .then((message) => {
        document.body.appendChild(document.createTextNode(message))
    })
    .then(() => sdk.resetPrivateKeyBackup('pa$$w0rd'))
    .then(() => sdk.cleanup())
    .catch((error) => {
        document.body.appendChild(document.createTextNode(error.toString()))
    });
