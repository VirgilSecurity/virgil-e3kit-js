const fs = require('fs');
const path = require('path');

const commonjs = require('rollup-plugin-commonjs');
const copy = require('rollup-plugin-copy');
const license = require('rollup-plugin-license');
const nodeBuiltins = require('rollup-plugin-node-builtins');
const nodeGlobals = require('rollup-plugin-node-globals');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-re');
const typescript = require('rollup-plugin-typescript2');
const { generateCrossPlatformPath } = require('../../utils/build');
const packageJson = require('./package.json');
const PRODUCT_NAME = 'e3kit';

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
    UMD: 'umd',
};

const CRYPTO_TYPE = {
    WASM: 'wasm',
    ASMJS: 'asmjs',
};

const TARGET = {
    BROWSER: 'browser',
    WORKER: 'worker',
};

const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');

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

const getCryptoEntryPointName = (target, cryptoType, format) =>
    `${target}${cryptoType === CRYPTO_TYPE.ASMJS ? '.asmjs' : ''}.${format}.js`;

const createEntry = (target, cryptoType, format) => {
    const foundationModuleName = 'virgil-crypto';
    const foundationPath = getModulePath(foundationModuleName);
    const foundationEntryPoint = generateCrossPlatformPath(
        foundationModuleName,
        'dist',
        getCryptoEntryPointName(target, cryptoType, FORMAT.ES),
    );

    const foundationWasmPath = generateCrossPlatformPath(
        foundationPath,
        'dist',
        `libfoundation.${target}.wasm`,
    );

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaPath = getModulePath(pythiaModuleName);
    const pythiaEntryPoint = generateCrossPlatformPath(
        pythiaModuleName,
        'dist',
        getCryptoEntryPointName(target, cryptoType, FORMAT.ES),
    );
    const pythiaWasmPath = generateCrossPlatformPath(
        pythiaPath,
        'dist',
        `libpythia.${target}.wasm`,
    );

    return {
        external: format !== FORMAT.UMD ? [foundationEntryPoint, pythiaEntryPoint] : [],
        input: path.join(sourcePath, 'index.ts'),
        output: {
            format,
            file: path.join(outputPath, getCryptoEntryPointName(target, cryptoType, format)),
            name: 'E3kit',
        },
        plugins: [
            replace({
                replaces: {
                    'process.env.__VIRGIL_PRODUCT_NAME__': JSON.stringify(PRODUCT_NAME),
                    'process.env.__VIRGIL_PRODUCT_VERSION__': JSON.stringify(packageJson.version),
                },
                patterns: [
                    {
                        match: /node_modules\/level-js\/(index|iterator)\.js/,
                        test: "var setImmediate = require('./util/immediate')",
                        replace: "var setImmediate = require('immediate')",
                    },
                    {
                        match: /node_modules\/level-js\/util\/clear\.js/,
                        test: "var setImmediate = require('./immediate')",
                        replace: "var setImmediate = require('immediate')",
                    },
                    {
                        match: /node_modules\/level-js\/util\/immediate-browser.js/,
                        test: "module.exports = require('immediate')",
                        replace: 'module.exports = {}',
                    },
                    {
                        match: /(index|EThree)\.ts$/,
                        test: foundationModuleName,
                        replace: foundationEntryPoint,
                    },
                    {
                        match: /EThree\.ts$/,
                        test: pythiaModuleName,
                        replace: pythiaEntryPoint,
                    },
                ],
            }),
            nodeResolve({ browser: true, preferBuiltins: true }),
            commonjs(),
            typescript({
                useTsconfigDeclarationDir: true,
                objectHashIgnoreUnknownHack: true,
                tsconfigOverride: {
                    compilerOptions: {
                        noImplicitAny: false,
                    },
                },
            }),
            nodeGlobals(),
            nodeBuiltins(),
            license({
                banner: {
                    content: {
                        file: path.join(__dirname, '..', '..', 'LICENSE'),
                    },
                },
            }),
            cryptoType === CRYPTO_TYPE.WASM &&
                copy({
                    targets: [
                        { src: foundationWasmPath, dest: outputPath },
                        { src: pythiaWasmPath, dest: outputPath },
                    ],
                }),
        ],
    };
};

module.exports = [
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.ES),
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.UMD),

    createEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.ES),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.UMD),
];
