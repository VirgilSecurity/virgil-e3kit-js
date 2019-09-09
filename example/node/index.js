const http = require('http');
const { EThree } = require('@virgilsecurity/e3kit');

const getJson = () => new Promise((resolve, reject) => {
    http.get('http://localhost:3000/get-virgil-jwt/', res => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200) {
            error = new Error(`Request failed. Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error(`Invalid content-type.\nExpected application/json, got ${contentType}`);
        }
        if (error) {
            console.error(error.message);
            // consume response data to free up memory
            res.resume();
            return;
        }

        let data = '';
        res.on('data', chunk => { data += chunk });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(data);
                resolve(parsedData);
            } catch(err) {
                console.error(err.message);
                reject(err);
            }
        });
    }).on('error', (err) => {
        console.error(`Error sending request: ${e.message}`);
        reject(err);
    });
})

const getToken = () => getJson('http://localhost:3000/get-virgil-jwt/')
    .then(data =>  data.token);

let sdk;

EThree.initialize(getToken)
    .then(client => sdk = client)
    .then(() => sdk.register())
    .then(() => sdk.backupPrivateKey('pa$$w0rd'))
    .then(() => sdk.encrypt('success!'))
    .then((encryptedMessage) => sdk.decrypt(encryptedMessage))
    .then((message) => console.log(message))
    .then(() => sdk.resetPrivateKeyBackup('pa$$w0rd'))
    .then(() => sdk.cleanup())
    .catch((error) => console.error(error.toString()));
