import { EThree } from './dist/browser.es';
import foundationWasm from './dist/libfoundation.browser.wasm';
import pythiaWasm from './dist/libpythia.browser.wasm';

const rawInitialize = EThree.initialize;

EThree.initialize = (getToken, options) =>
    rawInitialize(getToken, {
        ...options,
        foundationWasmPath:
            options && options.foundationWasmPath ? options.foundationWasmPath : foundationWasm,
        pythiaWasmPath: options && options.pythiaWasmPath ? options.pythiaWasmPath : pythiaWasm,
    });

export * from './dist/browser.es';
