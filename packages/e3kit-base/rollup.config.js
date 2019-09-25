const path = require('path');

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
        file: path.join(outputPath, `e3kit-base.${format}.js`),
    },
    plugins: [typescript({ useTsconfigDeclarationDir: true })],
});

module.exports = [createEntry(FORMAT.CJS), createEntry(FORMAT.ES)];
