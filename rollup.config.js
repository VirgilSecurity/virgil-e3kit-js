const path = require('path');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-re');
const { terser } = require('rollup-plugin-terser');
const typescript = require('rollup-plugin-typescript2');
const copy = require('rollup-plugin-copy');
const ignoreImport = require('rollup-plugin-ignore-import');
const builtinModules = require('builtin-modules');

const packageJson = require('./package.json');

const PRODUCT_NAME = 'e3kit';

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
    UMD: 'umd',
};

const CRYPTO_TYPE = {
    WASM: 'wasm',
    ASMJS: 'asmjs'
};

const TARGET = {
    BROWSER: 'browser',
    WORKER: 'worker',
    NODE: 'node'
};

const sourceDir = path.join(__dirname, 'src');
const outputDir = path.join(__dirname, 'dist');

const createNativeEntry = () => {
    const external = ['@virgilsecurity/key-storage-rn/native', 'react-native-virgil-crypto']
        .concat(Object.keys(packageJson.dependencies));

    return {
        input: path.join(sourceDir, 'index.native.ts'),
        output: {
            format: 'es',
            file: path.join(outputDir, 'native.es.js')
        },
        external,
        plugins: [
            replace({
              'process.env.PRODUCT_NAME': JSON.stringify(PRODUCT_NAME),
              'process.env.PRODUCT_VERSION': JSON.stringify(packageJson.version),
            }),
            nodeResolve({ browser: true }),
            commonjs(),
            typescript({
                typescript: require('typescript'),
                exclude: ['**/*.test.ts'],
                useTsconfigDeclarationDir: true,
                objectHashIgnoreUnknownHack: true,
                tsconfigOverride: { compilerOptions: { target: 'es2015' } }
            }),
        ],
    }
};

const getCryptoEntryPointName = (target, cryptoType, format) => {
    return `${target}${cryptoType === CRYPTO_TYPE.ASMJS ? '.asmjs' : ''}.${format}.js`
};

const createBrowserEntry = (target, cryptoType, format) => {
    const foundationModuleName = '@virgilsecurity/core-foundation';
    const foundationPath = path.resolve('node_modules', foundationModuleName);
    const foundationEntryPoint = path.join(foundationModuleName, getCryptoEntryPointName(target, cryptoType, FORMAT.ES));
    const foundationWasmPath = path.join(foundationPath, `libfoundation.${target}.wasm`);

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaPath = path.resolve('node_modules', pythiaModuleName);
    const pythiaEntryPoint = path.join(pythiaModuleName, 'dist', getCryptoEntryPointName(target, cryptoType, FORMAT.ES));
    const pythiaWasmPath = path.join(pythiaPath, 'dist', `libpythia.${target}.wasm`);

    const outputFileName = getCryptoEntryPointName(target, cryptoType, format);
    const umdName = format === FORMAT.UMD ? 'E3kit' : undefined;

    const tsconfigOverride = format === FORMAT.ES ? { compilerOptions: { target: 'es2015' } } : {};

    return {
        input: path.join(sourceDir, 'index.ts'),
        output: {
            format,
            file: path.join(outputDir, outputFileName),
            name: umdName
        },
        plugins: [
            replace({
              'process.env.PRODUCT_NAME': JSON.stringify(PRODUCT_NAME),
              'process.env.PRODUCT_VERSION': JSON.stringify(packageJson.version),
            }),
            replace({
                patterns: [
                    {
                        match: /EThree\.ts$/,
                        test: foundationModuleName,
                        replace: foundationEntryPoint
                    },
                    {
                        match: /(EThree|prepareBaseConstructorParams)\.ts$/,
                        test: pythiaModuleName,
                        replace: pythiaEntryPoint
                    }
                ],
            }),
            nodeResolve({ browser: true, extensions: ['.js', '.ts' ] }),
            cryptoType === CRYPTO_TYPE.WASM && ignoreImport({
                include: ['node_modules/**/*.wasm'],
                exclude: [],
            }),
            commonjs(),
            typescript({
                typescript: require('typescript'),
                exclude: ['**/*.test.ts'],
                useTsconfigDeclarationDir: true,
                objectHashIgnoreUnknownHack: true,
                tsconfigOverride
            }),
            cryptoType === CRYPTO_TYPE.WASM && copy({
                targets: [
                    { src: foundationWasmPath, dest: outputDir },
                    { src: pythiaWasmPath, dest: outputDir }
                ]
            }),
            format === FORMAT.UMD && terser()
        ].filter(Boolean),
    };
};

const createNodeJsEntry = (cryptoType, format) => {
    const foundationModuleName = '@virgilsecurity/core-foundation';
    const foundationEntryPoint = path.join(foundationModuleName, getCryptoEntryPointName(TARGET.NODE, cryptoType, format));

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaEntryPoint = path.join(pythiaModuleName, 'dist', getCryptoEntryPointName(TARGET.NODE, cryptoType, format));

    const external = builtinModules.concat(Object.keys(packageJson.dependencies)).concat([foundationEntryPoint, pythiaEntryPoint]);
    const outputFileName = getCryptoEntryPointName(TARGET.NODE, cryptoType, format);
    const tsconfigOverride = format === FORMAT.ES ? { compilerOptions: { target: 'es2015' } } : {};

    return {
        input: path.join(sourceDir, 'index.node.ts'),
        output: {
            format,
            file: path.join(outputDir, outputFileName)
        },
        external,
        plugins: [
            replace({
              'process.env.PRODUCT_NAME': JSON.stringify(PRODUCT_NAME),
              'process.env.PRODUCT_VERSION': JSON.stringify(packageJson.version),
            }),
            replace({
                patterns: [
                    {
                        match: /EThreeNode\.ts$/,
                        test: foundationModuleName,
                        replace: foundationEntryPoint
                    },
                    {
                        match: /(EThreeNode|prepareBaseConstructorParams)\.ts$/,
                        test: pythiaModuleName,
                        replace: pythiaEntryPoint
                    }
                ],
            }),
            nodeResolve({ extensions: ['.js', '.ts' ] }),
            typescript({
                typescript: require('typescript'),
                exclude: ['**/*.test.ts'],
                useTsconfigDeclarationDir: true,
                objectHashIgnoreUnknownHack: true,
                tsconfigOverride
            })
        ].filter(Boolean),
    };
}

module.exports = [
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.UMD),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.ES),

    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.UMD),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.ES),

    createNodeJsEntry(CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createNodeJsEntry(CRYPTO_TYPE.WASM, FORMAT.CJS),
    createNodeJsEntry(CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createNodeJsEntry(CRYPTO_TYPE.WASM, FORMAT.ES),

    createNativeEntry(),
];
