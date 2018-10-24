const express = require('express');
const cors = require('cors');
const { JwtGenerator } = require('virgil-sdk');
const { VirgilCrypto, VirgilAccessTokenSigner } = require('virgil-crypto');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const crypto = new VirgilCrypto();
const { APP_ID, API_KEY_ID, API_KEY } = process.env;

const generator = new JwtGenerator({
  appId: APP_ID,
  apiKeyId: API_KEY_ID,
  apiKey: crypto.importPrivateKey(API_KEY),
  accessTokenSigner: new VirgilAccessTokenSigner(crypto)
});

const IDENTITY = 'TEST_IDENTITY';

app.use(cors({ origin: true, methods: 'OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE', }));
app.get('/get-virgil-jwt', (_req, res) => {
  const virgilJwtToken = generator.generateToken(IDENTITY);
  res.json({ token: virgilJwtToken.toString() });
});

app.listen(3000, () => console.log(`Example app listening on port http://localhost:3000!`))

// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
// exports.api = functions.https.onRequest(app);
