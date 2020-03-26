const { EThree } = require('./dist/worker.cjs');
const foundationWasm = require('./dist/libfoundation.worker.wasm');
const pythiaWasm = require('./dist/libpythia.worker.wasm');

const rawInitialize = EThree.initialize;

EThree.initialize = (getToken, options) =>
    rawInitialize(getToken, {
        ...options,
        foundationWasmPath:
            options && options.foundationWasmPath ? options.foundationWasmPath : foundationWasm,
        pythiaWasmPath: options && options.pythiaWasmPath ? options.pythiaWasmPath : pythiaWasm,
    });

module.exports = require('./dist/worker.cjs');
