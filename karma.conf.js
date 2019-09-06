require('dotenv').config();

const commonjs = require('rollup-plugin-commonjs');
const nodeResolve = require('rollup-plugin-node-resolve');
const replace = require('rollup-plugin-replace');
const typescript = require('rollup-plugin-typescript2');
const wasm = require('rollup-plugin-wasm');


module.exports = function (config) {
    config.set({
        frameworks: ['mocha'],
        files: [
            { pattern: 'src/__tests__/**/*.test.ts' },
            { pattern: 'node_modules/@virgilsecurity/core-foundation/libfoundation.browser.wasm', included: false },
            { pattern: 'node_modules/@virgilsecurity/core-pythia/libpythia.browser.wasm', included: false },
        ],
        proxies: {
            '/base/src/__tests__/libfoundation.browser.wasm': '/base/node_modules/@virgilsecurity/core-foundation/libfoundation.browser.wasm',
            '/base/src/__tests__/libpythia.browser.wasm': '/base/node_modules/@virgilsecurity/core-pythia/libpythia.browser.wasm',
        },
        autoWatch: false,
        browsers: ['ChromeHeadless'],
        colors: true,
        mime: {
            'text/x-typescript': ['ts'],
            'application/wasm': ['wasm']
        },
        logLevel: config.LOG_INFO,
        browserNoActivityTimeout: 60 * 1000,
        singleRun: true,
        reporters: ['spec'],
        specReporter: {
            showSpecTiming: true,      // print the time elapsed for each spec
        },
        preprocessors: {
            'src/**/*.ts': ['rollup'],
        },
        client: {
            mocha: {
                timeout: 15000,
            }
        },

        rollupPreprocessor: {
            output: {
                format: 'iife',
                name: 'virgil',
                sourcemap: false
            },
            plugins: [
                nodeResolve({
                    browser: true,
                    extensions: ['.js', '.ts'],
                }),
                commonjs(),
                replace({
                    'process.env.API_KEY_ID': JSON.stringify(process.env.API_KEY_ID),
                    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
                    'process.env.APP_ID': JSON.stringify(process.env.APP_ID),
                    'process.env.API_URL': JSON.stringify(process.env.API_URL),
                    'process.env.NODE_ENV': process.env.NODE_ENV || JSON.stringify('production'),
                }),
                typescript({
                    typescript: require('typescript'),
                    useTsconfigDeclarationDir: true,
                    objectHashIgnoreUnknownHack: true,
                }),
                wasm()
            ],
        },
    });
};
