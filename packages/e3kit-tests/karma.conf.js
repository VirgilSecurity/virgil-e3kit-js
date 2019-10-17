const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const typescript = require('rollup-plugin-typescript2');
const wasm = require('rollup-plugin-wasm');

dotenv.config();

const getModulePath = request => {
    const resolvePaths = require.resolve.paths(request);
    for (let resolvePath of resolvePaths) {
        const modulePath = path.join(resolvePath, request);
        if (fs.existsSync(modulePath)) {
            return modulePath;
        }
    }
    throw new Error(`Module '${request}' was not found`);
};

const foundationPath = getModulePath('@virgilsecurity/core-foundation');
const pythiaPath = getModulePath('@virgilsecurity/core-pythia');

module.exports = config => {
    config.set({
        frameworks: ['mocha'],
        autoWatch: false,
        files: [
            { pattern: 'src/**/*.test.ts' },
            { pattern: path.join(foundationPath, 'libfoundation.browser.wasm'), included: false },
            { pattern: path.join(pythiaPath, 'libpythia.browser.wasm'), included: false },
        ],
        proxies: {
            '/base/src/libfoundation.browser.wasm': `${foundationPath}/libfoundation.browser.wasm`,
            '/base/src/libpythia.browser.wasm': `${pythiaPath}/libpythia.browser.wasm`,
        },
        browsers: ['ChromeHeadless'],
        colors: true,
        logLevel: config.LOG_INFO,
        browserNoActivityTimeout: 60 * 1000,
        singleRun: true,
        mime: {
            'text/x-typescript': ['ts'],
            'application/wasm': ['wasm'],
        },
        preprocessors: {
            'src/**/*.ts': ['rollup'],
        },
        client: {
            mocha: {
                timeout: 15000,
            },
        },
        rollupPreprocessor: {
            output: {
                format: 'iife',
                name: 'virgil',
                sourcemap: false,
            },
            plugins: [
                replace({
                    '@virgilsecurity/e3kit-node': '@virgilsecurity/e3kit',
                    'process.env.API_KEY_ID': JSON.stringify(process.env.API_KEY_ID),
                    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
                    'process.env.APP_ID': JSON.stringify(process.env.APP_ID),
                    'process.env.API_URL': JSON.stringify(process.env.API_URL),
                    'process.env.NODE_ENV': process.env.NODE_ENV || JSON.stringify('production'),
                }),
                nodeResolve({
                    browser: true,
                    extensions: ['.js', '.ts'],
                }),
                commonjs({
                    namedExports: { chai: ['expect'] },
                }),
                typescript(),
                wasm(),
            ],
        },
    });
};
