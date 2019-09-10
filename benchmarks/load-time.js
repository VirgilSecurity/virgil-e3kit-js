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

const copyFiles = filePaths => {
    filePaths.forEach(filePath => {
        const copyPath = path.join(__dirname, path.parse(filePath).base);
        if (fs.existsSync(copyPath)) {
            fs.unlinkSync(copyPath);
        }
        fs.copyFileSync(filePath, copyPath);
    });
};

const runLighthouse = async () => {
    const chrome = await chromeLauncher.launch();
    const { lhr: wasm } = await lighthouse(`http://localhost:${PORT}/new-wasm`, {
        onlyCategories: ['performance'],
        port: chrome.port,
    });
    const { lhr: newAsmjs } = await lighthouse(`http://localhost:${PORT}/new-asmjs`, {
        onlyCategories: ['performance'],
        port: chrome.port,
    });
    const { lhr: oldAsmjs } = await lighthouse(`http://localhost:${PORT}/old-asmjs`, {
        onlyCategories: ['performance'],
        port: chrome.port,
    });
    await chrome.kill();
    return {
        wasm,
        newAsmjs,
        oldAsmjs,
    };
};

const getLoadTimeLines = () => new Promise(async resolve => {
    await initCrypto();

    copyFiles(copy);

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
        const { wasm, newAsmjs, oldAsmjs } = await runLighthouse();
        server.close(() => {
            resolve([
                '## Load time',
                '|Type|Load time (seconds)|',
                '|-|-|',
                `|WebAssembly|${wasm.audits['first-contentful-paint'].displayValue}|`,
                `|new asm.js|${newAsmjs.audits['first-contentful-paint'].displayValue}|`,
                `|old asm.js|${oldAsmjs.audits['first-contentful-paint'].displayValue}|`,
            ]);
        });
    });
});

module.exports = getLoadTimeLines;
