const path = require('path');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-re');
const { terser } = require('rollup-plugin-terser');
const typescript = require('rollup-plugin-typescript2');
const copy = require('rollup-plugin-copy');

const FORMAT = {
    CJS: 'cjs',
    ES: 'es',
    UMD: 'umd',
};

const sourceDir = path.join(__dirname, 'src');
const outputDir = path.join(__dirname, 'dist');

const createNativeEntry = () => ({
    input: path.join(sourceDir, 'index.native.ts'),
    output: {
        format: 'es',
        file: path.join(outputDir, 'native.es.js')
    },
    plugins: [
        nodeResolve({ browser: true }),
        commonjs(),
        typescript({
            exclude: ['**/*.test.ts'],
            useTsconfigDeclarationDir: true
        }),
    ],
});

const createUmdEntry = (foundationLibrary, outputFileName) => ({
    input: path.join(sourceDir, 'index.ts'),
    output: {
        format: 'umd',
        file: path.join(outputDir, outputFileName),
        name: 'E3kit'
    },
    plugins: [
        replace({
            patterns: [
                {
                    match: /EThree\.ts$/,
                    test: '@virgilsecurity/core-foundation',
                    replace: foundationLibrary
                },
            ],
        }),
        copy({
            targets: [
                { src: require.resolve(foundationLibrary), dest: outputDir }
            ]
        }),
        nodeResolve({ browser: true }),
        commonjs(),
        typescript({
            exclude: ['**/*.test.ts'],
            useTsconfigDeclarationDir: true
        }),
        terser(),
    ],
});

const createModuleEntry = (foundationLibrary, format) => {
    const outputFileName = `${path.parse(foundationLibrary).name}.js`;
    const isBrowser = outputFileName.startsWith('browser') || outputFileName.startsWith('worker');
    return {
        input: path.join(sourceDir, 'index.ts'),
        output: {
            format,
            file: path.join(outputDir, outputFileName)
        },
        plugins: [
            replace({
                patterns: [
                    {
                        match: /EThree\.ts$/,
                        test: '@virgilsecurity/core-foundation',
                        replace: foundationLibrary
                    },
                ],
            }),
            copy({
                targets: [
                    { src: require.resolve(foundationLibrary), dest: outputDir }
                ]
            }),
            nodeResolve({ browser: isBrowser }),
            commonjs(),
            typescript({
                exclude: ['**/*.test.ts'],
                useTsconfigDeclarationDir: true
            }),
        ],
    };
};

module.exports = [
    createUmdEntry('@virgilsecurity/core-foundation/browser.asmjs.es.js', 'browser.asmjs.umd.js'),
    createUmdEntry('@virgilsecurity/core-foundation/browser.es.js', 'browser.umd.js'),
    createUmdEntry('@virgilsecurity/core-foundation/worker.asmjs.es.js', 'worker.asmjs.umd.js'),
    createUmdEntry('@virgilsecurity/core-foundation/worker.es.js', 'worker.umd.js'),

    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/browser.asmjs.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/browser.asmjs.es.js'),
    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/browser.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/browser.es.js'),
    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/node.asmjs.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/node.asmjs.es.js'),
    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/node.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/node.es.js'),
    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/worker.asmjs.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/worker.asmjs.es.js'),
    createModuleEntry(FORMAT.CJS, '@virgilsecurity/core-foundation/worker.cjs.js'),
    createModuleEntry(FORMAT.ES, '@virgilsecurity/core-foundation/worker.es.js'),

    createNativeEntry(),
];
