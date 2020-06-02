const path = require('path');

const builtinModules = require('builtin-modules');
const license = require('rollup-plugin-license');
const replace = require('rollup-plugin-re');
const typescript = require('rollup-plugin-typescript2');
const json = require('@rollup/plugin-json');
const { generateCrossPlatformPath } = require('../../utils/build');

const packageJson = require('./package.json');

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
    let foundationEntryPoint = generateCrossPlatformPath(
        foundationModuleName,
        'dist',
        getCryptoEntryPointName(cryptoType, format),
    );

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaEntryPoint = generateCrossPlatformPath(
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
            replace({
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
            json(),
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
