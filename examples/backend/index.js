const dotenv = require('dotenv');
const express = require('express');
const { initCrypto, VirgilCrypto, VirgilAccessTokenSigner } = require('virgil-crypto');
const { JwtGenerator } = require('virgil-sdk');

dotenv.config();

const PORT = process.env.PORT || 8080;

const app = express();

(async () => {
    await initCrypto();

    const virgilCrypto = new VirgilCrypto();
    const accessTokenSigner = new VirgilAccessTokenSigner(virgilCrypto);
    const apiKey = virgilCrypto.importPrivateKey({
        value: process.env.API_KEY,
        encoding: 'base64',
    });
    const jwtGenerator = new JwtGenerator({
        apiKey,
        accessTokenSigner,
        appId: process.env.APP_ID,
        apiKeyId: process.env.APP_KEY_ID,
        apiUrl: process.env.APP_URL,
    });

    app.get('/virgil-jwt', (request, response) => {
        const jwt = jwtGenerator.generateToken(request.query.identity);
        response.header('Access-Control-Allow-Origin', '*');
        response.json({ virgil_jwt: jwt.toString() });
    });

    app.listen(PORT, () => {
        console.log(`Sample backend is running on port ${PORT}`);
    });
})();
