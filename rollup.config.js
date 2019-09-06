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
    WORKER: 'worker'
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

const getBrowserCryptoEntryPointName = (target, cryptoType, format) => {
    return `${target}${cryptoType === CRYPTO_TYPE.ASMJS ? '.asmjs' : ''}.${format}.js`
};

const createBrowserEntry = (target, cryptoType, format) => {
    const foundationModuleName = '@virgilsecurity/core-foundation';
    const foundationPath = path.resolve('node_modules', foundationModuleName);
    const foundationEntryPoint = path.join(foundationModuleName, getBrowserCryptoEntryPointName(target, cryptoType, FORMAT.ES));
    const foundationWasmPath = path.join(foundationPath, `libfoundation.${target}.wasm`);

    const pythiaModuleName = '@virgilsecurity/pythia-crypto';
    const pythiaPath = path.resolve('node_modules', pythiaModuleName);
    const pythiaEntryPoint = path.join(pythiaModuleName, 'dist', getBrowserCryptoEntryPointName(target, cryptoType, FORMAT.ES));
    const pythiaWasmPath = path.join(pythiaPath, 'dist', `libpythia.${target}.wasm`);

    const outputFileName = getBrowserCryptoEntryPointName(target, cryptoType, format);
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
                patterns: [
                    {
                        match: /EThree\.ts$/,
                        test: '@virgilsecurity/core-foundation',
                        replace: foundationEntryPoint
                    },
                    {
                        match: /EThree\.ts$/,
                        test: '@virgilsecurity/pythia-crypto',
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

module.exports = [
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.UMD),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.UMD),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.UMD),

    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createBrowserEntry(TARGET.BROWSER, CRYPTO_TYPE.WASM, FORMAT.ES),

    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.CJS),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.ASMJS, FORMAT.ES),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.CJS),
    createBrowserEntry(TARGET.WORKER, CRYPTO_TYPE.WASM, FORMAT.ES),

    // createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/node.asmjs.cjs.js', '@virgilsecurity/pythia-crypto/dist/node.asmjs.cjs.js'),
    // createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/node.asmjs.es.js', '@virgilsecurity/pythia-crypto/dist/node.asmjs.es.js'),
    // createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/node.cjs.js', '@virgilsecurity/pythia-crypto/dist/node.cjs.js'),
    // createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/node.es.js', '@virgilsecurity/pythia-crypto/dist/node.es.js'),

    createNativeEntry(),
];
