const fs = require('fs');
const path = require('path');

const getModulePath = request => {
    const resolvePaths = require.resolve.paths(request);
    for (let resolvePath of resolvePaths) {
        const modulePath = path.join(resolvePath, request);
        if (fs.existsSync(modulePath)) {
            return modulePath;
        }
    }
    throw new Error(`Module '${request}' was not found`);
};

const htmlPath = path.join(__dirname, 'index.html');
const e3kitPath = getModulePath('@virgilsecurity/e3kit');
const e3kitJsPath = path.join(e3kitPath, 'dist', 'browser.umd.js');
const foundationWasmPath = path.join(e3kitPath, 'dist', 'libfoundation.browser.wasm');
const pythiaWasmPath = path.join(e3kitPath, 'dist', 'libpythia.browser.wasm');

const outputPath = path.join(__dirname, 'dist');
const htmlOutputPath = path.join(outputPath, path.parse(htmlPath).base);
const e3kitJsOutputPath = path.join(outputPath, path.parse(e3kitJsPath).base);
const foundationWasmOutputPath = path.join(outputPath, path.parse(foundationWasmPath).base);
const pythiaWasmOutputPath = path.join(outputPath, path.parse(pythiaWasmPath).base);

if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
}
fs.copyFileSync(htmlPath, htmlOutputPath);
fs.copyFileSync(e3kitJsPath, e3kitJsOutputPath);
fs.copyFileSync(foundationWasmPath, foundationWasmOutputPath);
fs.copyFileSync(pythiaWasmPath, pythiaWasmOutputPath);
