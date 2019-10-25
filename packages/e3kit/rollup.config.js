const fs = require('fs');
const path = require('path');

const copy = require('rollup-plugin-copy');
const license = require('rollup-plugin-license');
const replace = require('rollup-plugin-re');
const typescript = require('rollup-plugin-typescript2');

const packageJson = require('./package.json');

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
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
        external: Object.keys(packageJson.dependencies),
        input: path.join(sourcePath, 'index.ts'),
        output: {
            format,
            file: path.join(outputPath, getCryptoEntryPointName(target, cryptoType, format)),
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
                        match: /EThree\.ts$/,
                        test: pythiaModuleName,
                        replace: pythiaEntryPoint,
                    },
                ],
            }),
            typescript({
                useTsconfigDeclarationDir: true,
                objectHashIgnoreUnknownHack: true,
                tsconfigOverride: {
                    compilerOptions: {
                        noImplicitAny: false,
                    },
                },
            }),
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

    createEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.ES),
];
