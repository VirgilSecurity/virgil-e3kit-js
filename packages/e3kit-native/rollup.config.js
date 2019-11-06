const path = require('path');

const commonjs = require('rollup-plugin-commonjs');
const license = require('rollup-plugin-license');
const nodeResolve = require('rollup-plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');
const builtins = require('rollup-plugin-node-builtins');
const globals = require('rollup-plugin-node-globals');
const replace = require('rollup-plugin-re');

const packageJson = require('./package.json');
const PRODUCT_NAME = 'e3kit';

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
};

const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');

const createEntry = format => ({
    external: [
        '@react-native-community/async-storage',
        '@virgilsecurity/key-storage-rn/native',
        'react-native',
        'react-native-virgil-crypto',
        'react-native-keychain',
    ],
    input: path.join(sourcePath, 'index.ts'),
    output: {
        format,
        file: path.join(outputPath, `e3kit-native.${format}.js`),
    },
    plugins: [
        replace({
            replaces: {
                'process.env.PRODUCT_NAME': JSON.stringify(PRODUCT_NAME),
                'process.env.PRODUCT_VERSION': JSON.stringify(packageJson.version),
            },
        }),
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        globals(),
        builtins(),
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
});

module.exports = [createEntry(FORMAT.CJS), createEntry(FORMAT.ES)];
