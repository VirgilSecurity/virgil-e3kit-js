const paths = require('./paths');
const plugins = require('./rollup-plugins');

const format = paths.formats.es;

module.exports = {
    input: paths.input,
    output: {
        format: format,
        file: paths.getFileName(format, false),
        dir: paths.outputDir,
        sourcemap: true,
    },
    plugins: [
        plugins.resolveVirgilCrypto(),
        plugins.resolve({ browser: true }),
        plugins.commonjs(),
        plugins.replace,
        plugins.typescriptResolved,
        plugins.nodeGlobals,
        plugins.inject,
    ],
};
