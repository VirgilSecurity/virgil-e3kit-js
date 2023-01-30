import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    preset: 'ts-jest',
    transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.js?$': 'babel-jest', // had to add this
    },
    testMatch: ['**.ts'],
    runner: 'jest-runner-mocha',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleDirectories: ['node_modules', 'src'],
    transformIgnorePatterns: ['e3kit-tests/node_modules'],
};

export default config;
