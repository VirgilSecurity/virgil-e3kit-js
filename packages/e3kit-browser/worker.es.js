import { EThree } from './dist/worker.es';
import foundationWasm from './dist/libfoundation.worker.wasm';
import pythiaWasm from './dist/libpythia.worker.wasm';

const rawInitialize = EThree.initialize;

EThree.initialize = (getToken, options) =>
    rawInitialize(getToken, {
        ...options,
        foundationWasmPath:
            options && options.foundationWasmPath ? options.foundationWasmPath : foundationWasm,
        pythiaWasmPath: options && options.pythiaWasmPath ? options.pythiaWasmPath : pythiaWasm,
    });

export * from './dist/worker.es';
