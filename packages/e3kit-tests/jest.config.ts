import type { Config } from 'jest';

const config: Config = {
    verbose: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.ts?$': 'ts-jest',
        '^.+\\.js?$': 'babel-jest', // had to add this
    },
    //testMatch: ['*.spec.ts'],
    //runner: 'jest-runner-mocha',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleDirectories: ['node_modules', 'src'],
    transformIgnorePatterns: [],
};

export default config;
