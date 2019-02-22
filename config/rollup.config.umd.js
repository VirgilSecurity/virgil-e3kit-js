const paths = require('./paths');
const plugins = require('./rollup-plugins');

const UMD_NAME = 'E3kit';

module.exports = {
    input: paths.input,
    output: {
        format: paths.formats.umd,
        file: paths.getFileName(paths.formats.umd, true),
        dir: paths.outputDir,
        sourcemap: true,
        name: UMD_NAME
    },
    plugins: [
        plugins.sourcemap(),
        plugins.resolveVirgilCrypto(),
        plugins.resolve({ browser: true }),
        plugins.commonjs(),
        plugins.typescriptResolved,
        plugins.nodeGlobals,
		plugins.inject,
        process.env.NODE_ENV === 'production' && plugins.uglify(),
    ],
};
