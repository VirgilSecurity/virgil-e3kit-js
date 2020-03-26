const { EThree } = require('./dist/browser.cjs');
const foundationWasm = require('./dist/libfoundation.browser.wasm');
const pythiaWasm = require('./dist/libpythia.browser.wasm');

const rawInitialize = EThree.initialize;

EThree.initialize = (getToken, options) =>
    rawInitialize(getToken, {
        ...options,
        foundationWasmPath:
            options && options.foundationWasmPath ? options.foundationWasmPath : foundationWasm,
        pythiaWasmPath: options && options.pythiaWasmPath ? options.pythiaWasmPath : pythiaWasm,
    });

module.exports = require('./dist/browser.cjs');
