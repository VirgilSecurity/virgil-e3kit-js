require('dotenv').config();
const paths = require('./paths');

const commonjs = require('rollup-plugin-commonjs');
const inject = require('rollup-plugin-inject');
const nodeGlobals = require('rollup-plugin-node-globals');
const resolve = require('rollup-plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');
const { uglify } = require('rollup-plugin-uglify');
const sourcemap = require('rollup-plugin-sourcemaps');
const replace = require('rollup-plugin-replace');

function resolveVirgilCrypto () {
    return {
        name: 'resolve-virgil-crypto',
        resolveId (importee, b) {
            if (importee === 'virgil-crypto') {
                return paths.pythiaCryptoPath;
            }
            return null;
        }
    }
}

class RollupPluginsResolver {

    constructor() {
        this.commonjs = commonjs;
        this.nodeGlobals = nodeGlobals();
        this.resolve = resolve;
        this.sourcemap = sourcemap;
        this.uglify = uglify;
        this.resolveVirgilCrypto = resolveVirgilCrypto;
        this.typescriptResolved = typescript({
            useTsconfigDeclarationDir: true,
        });
        this.inject = inject({
			include: '**/*.ts',
			exclude: 'node_modules/**',
			modules: {
				Buffer: [ 'buffer-es6', 'Buffer' ]
			}
        })
        this.replace = replace({
            'process.env.API_KEY_ID': JSON.stringify(process.env.API_KEY_ID),
            'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
            'process.env.APP_ID': JSON.stringify(process.env.APP_ID),
            'process.env.API_URL': JSON.stringify(process.env.API_URL),
            'process.env.NODE_ENV': JSON.stringify('production'),
        })
    }
}

module.exports = new RollupPluginsResolver();
