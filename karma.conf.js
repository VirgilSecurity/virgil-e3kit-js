const umdConfig = require('./config/rollup.config.umd');

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
            plugins: umdConfig.plugins,
            output: umdConfig.output,
        },
    });
};
