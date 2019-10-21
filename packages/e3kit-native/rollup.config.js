const path = require('path');

const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
};

const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');

const createEntry = format => ({
    external: [
        '@react-native-community/async-storage',
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
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        typescript({
            useTsconfigDeclarationDir: true,
            tsconfigOverride: {
                compilerOptions: {
                    noImplicitAny: false,
                },
            },
        }),
    ],
});

module.exports = [createEntry(FORMAT.CJS), createEntry(FORMAT.ES)];
