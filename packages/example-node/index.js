const http = require('http');
const querystring = require('querystring');

const { EThree } = require('@virgilsecurity/e3kit-node');
const dotenv = require('dotenv');

console.log('Virgil E3Kit SDK + Node.js usage example');
console.log('If all goes well, you should see "Success" message printed below in a moment...');

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

const getToken = async () => {
    const query = querystring.stringify({
        identity: 'my-identity',
    });
    const { virgil_jwt: virgilJwt } = await getJson(`${API_URL}/virgil-jwt?${query}`);
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
        console.log(message);
    }
})();
