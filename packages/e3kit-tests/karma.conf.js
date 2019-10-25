const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
const webpack = require('webpack');

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
            'src/browser.test.ts',
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
            'src/browser.test.ts': ['webpack'],
        },
        client: {
            mocha: {
                timeout: 15000,
            },
        },
        webpack: {
            mode: 'production',
            resolve: {
                extensions: ['.js', '.ts'],
            },
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        loader: 'ts-loader',
                    },
                    {
                        test: /\.wasm$/,
                        type: 'javascript/auto',
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                        },
                    },
                ],
            },
            plugins: [
                new webpack.NormalModuleReplacementPlugin(
                    /@virgilsecurity\/e3kit-node/,
                    '@virgilsecurity/e3kit',
                ),
                new webpack.EnvironmentPlugin({
                    API_KEY_ID: JSON.stringify(process.env.API_KEY_ID),
                    API_KEY: JSON.stringify(process.env.API_KEY),
                    APP_ID: JSON.stringify(process.env.APP_ID),
                    API_URL: JSON.stringify(process.env.API_URL),
                    NODE_ENV: process.env.NODE_ENV || JSON.stringify('production'),
                }),
            ],
        },
    });
};
