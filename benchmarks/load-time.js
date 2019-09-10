const fs = require('fs');
const http = require('http');
const path = require('path');

const dotenv = require('dotenv');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const serveHandler = require('serve-handler');
const { initCrypto, VirgilCrypto, VirgilAccessTokenSigner } = require('virgil-crypto');
const { JwtGenerator } = require('virgil-sdk');

dotenv.config();

const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, '..', 'dist');
const copy = [
    path.join(distPath, 'browser.umd.js'),
    path.join(distPath, 'libfoundation.browser.wasm'),
    path.join(distPath, 'libpythia.browser.wasm'),
    path.join(distPath, 'browser.asmjs.umd.js'),
    path.join(__dirname, 'node_modules', '@virgilsecurity', 'e3kit-old', 'dist', 'e3kit.browser.umd.min.js'),
];

const getLoadTimeLines = () => new Promise(async resolve => {
    await initCrypto();

    copy.forEach(sourcePath => {
        const copiedPath = path.join(__dirname, path.parse(sourcePath).base);
        if (fs.existsSync(copiedPath)) {
            fs.unlinkSync(copiedPath);
        }
        fs.copyFileSync(sourcePath, copiedPath);
    });

    const virgilCrypto = new VirgilCrypto();
    const virgilAccessTokenSigner = new VirgilAccessTokenSigner(virgilCrypto);
    const virgilApiKey = virgilCrypto.importPrivateKey(process.env.API_KEY);
    const jwtGenerator = new JwtGenerator({
        appId: process.env.APP_ID,
        apiKey: virgilApiKey,
        apiKeyId: process.env.API_KEY_ID,
        accessTokenSigner: virgilAccessTokenSigner,
        millisecondsToLive:  20 * 60 * 1000
    });

    const server = http.createServer((request, response) => {
        if (request.url === '/get-jwt') {
            const jwt = jwtGenerator.generateToken('defaultIdentity');
            response.end(JSON.stringify({ token: jwt.toString() }));
        }
        return serveHandler(request, response, {
            public: __dirname,
            directoryListing: false,
            headers: [
                {
                    source: '*.wasm',
                    headers: [
                        { key: 'Content-Type', value: 'application/wasm' },
                    ],
                },
            ],
        });
    });

    server.listen(PORT, async () => {
        console.log(`Server is running at port ${PORT}`);
        const chrome = await chromeLauncher.launch();
        const { lhr: newWasmResults } = await lighthouse(`http://localhost:${PORT}/new-wasm`, {
            onlyCategories: ['performance'],
            port: chrome.port,
        });
        const { lhr: newAsmjsResults } = await lighthouse(`http://localhost:${PORT}/new-asmjs`, {
            onlyCategories: ['performance'],
            port: chrome.port,
        });
        const { lhr: oldAsmjsResults } = await lighthouse(`http://localhost:${PORT}/old-asmjs`, {
            onlyCategories: ['performance'],
            port: chrome.port,
        });
        await chrome.kill();
        server.close(() => {
            resolve([
                '## Load time',
                '|File|Load time (seconds)|',
                '|-|-|',
                `|browser.umd.js|${newWasmResults.audits['first-contentful-paint'].displayValue}|`,
                `|browser.asmjs.umd.js|${newAsmjsResults.audits['first-contentful-paint'].displayValue}|`,
                `|e3kit.browser.umd.min.js|${oldAsmjsResults.audits['first-contentful-paint'].displayValue}|`,
            ]);
        });
    });
});

module.exports = getLoadTimeLines;
