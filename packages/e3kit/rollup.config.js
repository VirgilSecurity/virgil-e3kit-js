const fs = require('fs');
const path = require('path');

const commonjs = require('rollup-plugin-commonjs');
const copy = require('rollup-plugin-copy');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-re');
const { terser } = require('rollup-plugin-terser');
const typescript = require('rollup-plugin-typescript2');

const packageJson = require('./package.json');

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
    const foundationModuleName = '@virgilsecurity/core-foundation';
    const foundationPath = getModulePath(foundationModuleName);
    const foundationEntryPoint = path.join(
        foundationModuleName,
        getCryptoEntryPointName(target, cryptoType, FORMAT.ES),
    );
    const foundationWasmPath = path.join(foundationPath, `libfoundation.${target}.wasm`);

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaPath = getModulePath(pythiaModuleName);
    const pythiaEntryPoint = path.join(
        pythiaModuleName,
        'dist',
        getCryptoEntryPointName(target, cryptoType, FORMAT.ES),
    );
    const pythiaWasmPath = path.join(pythiaPath, 'dist', `libpythia.${target}.wasm`);

    return {
        external: format !== FORMAT.UMD && Object.keys(packageJson.dependencies),
        input: path.join(sourcePath, 'index.ts'),
        output: {
            format,
            file: path.join(outputPath, getCryptoEntryPointName(target, cryptoType, format)),
            name: 'E3kit',
        },
        plugins: [
            replace({
                patterns: [
                    {
                        match: /EThree\.ts$/,
                        test: foundationModuleName,
                        replace: foundationEntryPoint,
                    },
                    {
                        match: /(EThree|prepareBaseConstructorParams)\.ts$/,
                        test: pythiaModuleName,
                        replace: pythiaEntryPoint,
                    },
                ],
            }),
            nodeResolve({ browser: true }),
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
            cryptoType === CRYPTO_TYPE.WASM &&
                copy({
                    targets: [
                        { src: foundationWasmPath, dest: outputPath },
                        { src: pythiaWasmPath, dest: outputPath },
                    ],
                }),
            format === FORMAT.UMD && terser(),
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