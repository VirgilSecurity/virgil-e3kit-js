import { EThree } from '@virgilsecurity/e3kit';

const getToken = async () => {
    const myIdentity = 'my-identity';
    const response = await fetch(`${process.env.API_URL}/virgil-jwt?identity=${myIdentity}`);
    const { virgil_jwt: virgilJwt } = await response.json();
    return virgilJwt;
};

(async () => {
    let message;
    try {
        const sdk = await EThree.initialize(getToken, {
            apiUrl: process.env.VIRGIL_API_URL,
        });
        await sdk.register();
        await sdk.backupPrivateKey('pa$$w0rd');
        const encryptedMessage = await sdk.encrypt('Success');
        message = await sdk.decrypt(encryptedMessage);
    } catch (error) {
        message = error.toString();
    } finally {
        const paragraph = document.createElement('p');
        const textNode = document.createTextNode(message);
        paragraph.appendChild(textNode);
        document.body.appendChild(paragraph);
    }
})();
