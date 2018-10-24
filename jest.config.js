const { jsWithBabel: tsjPreset } = require('ts-jest/presets');

module.exports = {
    "moduleFileExtensions": [
        "ts",
        "js",
        "json",
        "node"
    ],
    "setupTestFrameworkScriptFile": "./jest.setup.js",
    "testEnvironment": "node",
    "testPathIgnorePatterns": [
        "/node_modules/",
        "/dist/"
    ],
    "testRegex": "(/__tests__/.*(test|spec))\\.ts$",
    "transform": {
        "^.+\\.es\\.js$": "babel-jest",
        "^.+\\.ts$": "ts-jest",
    },
    globals: {
        'ts-jest': {
			tsConfig: 'tsconfig.test.json'
		}
    },
    moduleNameMapper: {
        "virgil-crypto": "<rootDir>/node_modules/virgil-crypto/dist/virgil-crypto-pythia.cjs.js"
    }
}
