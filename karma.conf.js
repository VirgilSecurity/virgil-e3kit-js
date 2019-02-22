const umdConfig = require('./config/rollup.config.umd');
const replace = require('rollup-plugin-replace');

module.exports = function (config) {
    config.set({
        frameworks: ['mocha'],
        files: [{
            pattern: 'src/__tests__/EThree.test.ts'
        }],
        autoWatch: false,
        browsers: ['ChromeHeadless'],
        colors: true,
        mime: {
            'text/x-typescript': ['ts']
        },
        logLevel: config.LOG_INFO,
        browserNoActivityTimeout: 60 * 1000,
        singleRun: true,
        reporters: ['spec'],
        preprocessors: {
            'src/**/*.ts': ['rollup'],
        },
        client: {
            mocha: {
                timeout: 15000,
            }
        },

        rollupPreprocessor: {
            plugins: [...umdConfig.plugins, this.replace = replace({
                'process.env.API_KEY_ID': JSON.stringify(process.env.API_KEY_ID),
                'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
                'process.env.APP_ID': JSON.stringify(process.env.APP_ID),
                'process.env.API_URL': JSON.stringify(process.env.API_URL),
                'process.env.NODE_ENV': process.env.NODE_ENV || JSON.stringify('production'),
            })],
            output: umdConfig.output,
        },
    });
};
