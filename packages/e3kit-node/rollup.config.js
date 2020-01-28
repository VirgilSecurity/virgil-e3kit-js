const path = require('path');

const builtinModules = require('builtin-modules');
const commonjs = require('rollup-plugin-commonjs');
const license = require('rollup-plugin-license');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-re');
const typescript = require('rollup-plugin-typescript2');

const packageJson = require('./package.json');
const PRODUCT_NAME = 'e3kit';

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
};

const CRYPTO_TYPE = {
    WASM: 'wasm',
    ASMJS: 'asmjs',
};

const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');

const getCryptoEntryPointName = (cryptoType, format) =>
    `node${cryptoType === CRYPTO_TYPE.ASMJS ? '.asmjs' : ''}.${format}.js`;

const createEntry = (cryptoType, format) => {
    const foundationModuleName = 'virgil-crypto';
    const foundationEntryPoint = path.join(
        foundationModuleName,
        'dist',
        getCryptoEntryPointName(cryptoType, format),
    );

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaEntryPoint = path.join(
        pythiaModuleName,
        'dist',
        getCryptoEntryPointName(cryptoType, format),
    );

    const external = builtinModules
        .concat(Object.keys(packageJson.dependencies))
        .concat([foundationEntryPoint, pythiaEntryPoint]);
    const outputFileName = getCryptoEntryPointName(cryptoType, format);

    return {
        external,
        input: path.join(sourcePath, 'index.ts'),
        output: {
            format,
            file: path.join(outputPath, outputFileName),
        },
        plugins: [
            nodeResolve(),
            commonjs(),
            replace({
                replaces: {
                    'process.env.PRODUCT_NAME': JSON.stringify(PRODUCT_NAME),
                    'process.env.PRODUCT_VERSION': JSON.stringify(packageJson.version),
                },
                patterns: [
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
            typescript({
                useTsconfigDeclarationDir: true,
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
        ],
    };
};

module.exports = [
    createEntry(CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createEntry(CRYPTO_TYPE.WASM, FORMAT.CJS),
    createEntry(CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createEntry(CRYPTO_TYPE.WASM, FORMAT.ES),
];
