const fs = require('fs');
const path = require('path');

const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: {
        browser: './dist/browser.es',
        'browser.asmjs': './dist/browser.asmjs.es',
        worker: './dist/worker.es',
        'worker.asmjs': './dist/worker.asmjs.es',
    },
    output: {
        library: 'E3kit',
        libraryTarget: 'umd',
        filename: '[name].umd.js',
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: fs.readFileSync(path.join(__dirname, '..', '..', 'LICENSE')).toString(),
        }),
    ],
};
