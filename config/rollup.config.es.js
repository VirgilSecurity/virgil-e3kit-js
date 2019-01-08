const paths = require('./paths');
const plugins = require('./rollup-plugins');
const packageJson = require('../package.json');

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
        plugins.typescriptResolved,
        paths.IS_BROWSER && plugins.injectResolved,
        paths.IS_BROWSER && plugins.nodeGlobals(),
    ],
};
