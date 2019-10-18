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
};
