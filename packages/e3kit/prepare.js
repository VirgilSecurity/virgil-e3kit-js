const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');

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

const createPaths = (baseDir, bases) => bases.map(base => path.join(baseDir, base));

const copyFiles = (sources, outputPath) => {
    sources.forEach(src => {
        const dest = path.join(outputPath, path.parse(src).base);
        fs.copyFileSync(src, dest);
    });
};

const browserDir = getModulePath('@virgilsecurity/e3kit-browser');
const browserDistFiles = createPaths(path.join(browserDir, 'dist'), [
    'browser.asmjs.cjs.js',
    'browser.asmjs.es.js',
    'browser.asmjs.umd.js',
    'browser.cjs.js',
    'browser.es.js',
    'browser.umd.js',
    'libfoundation.browser.wasm',
    'libfoundation.worker.wasm',
    'libpythia.browser.wasm',
    'libpythia.worker.wasm',
    'worker.asmjs.cjs.js',
    'worker.asmjs.es.js',
    'worker.asmjs.umd.js',
    'worker.cjs.js',
    'worker.es.js',
    'worker.umd.js',
]);
const browserExtraFiles = createPaths(browserDir, [
    'browser.cjs.js',
    'browser.es.js',
    'worker.cjs.js',
    'worker.es.js',
]);
const nativeDir = getModulePath('@virgilsecurity/e3kit-native');
const nativeDistFiles = createPaths(path.join(nativeDir, 'dist'), [
    'e3kit-native.cjs.js',
    'e3kit-native.es.js',
]);
const nodeDir = getModulePath('@virgilsecurity/e3kit-node');
const nodeDistFiles = createPaths(path.join(nodeDir, 'dist'), [
    'node.asmjs.cjs.js',
    'node.asmjs.es.js',
    'node.cjs.js',
    'node.cjs.js',
]);
const outputDir = __dirname;
const outputDistDir = path.join(outputDir, 'dist');

mkdirp.sync(outputDistDir);
copyFiles(browserDistFiles, outputDistDir);
copyFiles(browserExtraFiles, outputDir);
copyFiles(nativeDistFiles, outputDistDir);
copyFiles(nodeDistFiles, outputDistDir);
