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

const copyDir = (sourceDir, outputDir) => {
    const stack = [sourceDir];
    while (stack.length) {
        const entry = stack.pop();
        const parsedPath = path.parse(entry);
        const relativeDir = path.relative(sourceDir, parsedPath.dir);
        if (fs.lstatSync(entry).isDirectory()) {
            if (entry !== sourceDir) {
                mkdirp.sync(path.join(outputDir, relativeDir, parsedPath.base));
            }
            const files = fs.readdirSync(entry).map(base => path.join(entry, base));
            stack.push(...files);
        } else {
            fs.copyFileSync(entry, path.join(outputDir, relativeDir, parsedPath.base));
        }
    }
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
const browserTypesDir = path.join(browserDir, 'dist', 'types');
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
const outputTypesDir = path.join(outputDistDir, 'types');

mkdirp.sync(outputDistDir);
mkdirp.sync(outputTypesDir);
copyFiles(browserDistFiles, outputDistDir);
copyFiles(browserExtraFiles, outputDir);
copyFiles(nativeDistFiles, outputDistDir);
copyFiles(nodeDistFiles, outputDistDir);
copyDir(browserTypesDir, outputTypesDir);
