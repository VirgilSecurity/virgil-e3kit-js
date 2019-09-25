const path = require('path');

const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');

const packageJson = require('./package.json');

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
};

const sourcePath = path.join(__dirname, 'src');
const outputPath = path.join(__dirname, 'dist');

const createEntry = format => ({
    external: Object.keys(packageJson.dependencies),
    input: path.join(sourcePath, 'index.ts'),
    output: {
        format,
        file: path.join(outputPath, `e3kit-native.${format}.js`),
    },
    plugins: [
        nodeResolve({ browser: true }),
        commonjs(),
        typescript({ useTsconfigDeclarationDir: true }),
    ],
});

module.exports = [createEntry(FORMAT.CJS), createEntry(FORMAT.ES)];
