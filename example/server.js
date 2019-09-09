const express = require('express');
const cors = require('cors');
const { JwtGenerator } = require('virgil-sdk');
const crypto = require('crypto');
const { VirgilCrypto, VirgilAccessTokenSigner } = require('virgil-crypto');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const virgilCrypto = new VirgilCrypto();
const { APP_ID, API_KEY_ID, API_KEY } = process.env;

const generator = new JwtGenerator({
    appId: APP_ID,
    apiKeyId: API_KEY_ID,
    apiKey: virgilCrypto.importPrivateKey(API_KEY),
    accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto)
});


app.use(cors({ origin: true, methods: 'OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE', }));
app.get('/get-virgil-jwt', (_req, res) => {
    const IDENTITY = crypto.randomBytes(8).toString('base64');
    const virgilJwtToken = generator.generateToken(IDENTITY);
    res.json({ token: virgilJwtToken.toString() });
});

app.use(express.static('./umd/'));
app.use(express.static('../dist'));
// if you have express version < 4.17, uncomment the following line
// express.static.mime.types['wasm'] = 'application/wasm'

app.listen(3000, () => console.log(`Example app listening on port http://localhost:3000!`))
