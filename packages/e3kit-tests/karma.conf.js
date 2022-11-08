const dotenv = require('dotenv');
const webpack = require('webpack');

dotenv.config();

module.exports = (config) => {
    config.set({
        frameworks: ['mocha', 'karma-typescript'],
        autoWatch: true,
        files: [
            {
                pattern: 'src/browser/*.spec.ts',
                type: 'module',
            },
        ],
        browsers: ['ChromeHeadless'],
        colors: true,
        logLevel: config.DEBUG,
        browserNoActivityTimeout: 60 * 1000,
        singleRun: false,
        mime: {
            'text/x-typescript': ['ts'],
            'application/wasm': ['wasm'],
        },
        preprocessors: {
            'src/browser.test.ts': ['karma-typescript'],
        },
        client: {
            mocha: {
                timeout: 15000,
            },
        },
        reporters: ['spec', 'karma-typescript'],
        karmaTypescriptConfig: {
            bundlerOptions: {
                entrypoints: '**.spec.ts',
                transforms: [require('karma-typescript-es6-transform')()],
                resolve: 'src',
            },
            tsconfig: 'tsconfig.json',
        },
        // webpack: {
        //     mode: process.env.NODE_ENV || JSON.stringify('production'),
        //     resolve: {
        //         extensions: ['.js', '.ts'],
        //     },
        //     module: {
        //         rules: [
        //             {
        //                 test: /\.ts$/,
        //                 loader: 'ts-loader',
        //             },
        //             {
        //                 test: /\.wasm$/,
        //                 type: 'javascript/auto',
        //                 loader: 'file-loader',
        //             },
        //         ],
        //     },
        //     plugins: [
        //         new webpack.NormalModuleReplacementPlugin(
        //             /@virgilsecurity\/e3kit-node/,
        //             '@virgilsecurity/e3kit-browser',
        //         ),
        //         new webpack.EnvironmentPlugin({
        //             APP_KEY_ID: JSON.stringify(process.env.APP_KEY_ID),
        //             APP_KEY: JSON.stringify(process.env.APP_KEY),
        //             APP_ID: JSON.stringify(process.env.APP_ID),
        //             API_URL: JSON.stringify(process.env.API_URL),
        //             NODE_ENV: process.env.NODE_ENV || JSON.stringify('production'),
        //         }),
        //     ],
        // },
    });
};
