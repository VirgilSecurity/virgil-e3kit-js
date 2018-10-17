const path = require('path');
const commonjs = require('rollup-plugin-commonjs');
const inject = require('rollup-plugin-inject');
const nodeGlobals = require('rollup-plugin-node-globals');
const resolve = require('rollup-plugin-node-resolve');
const typescript = require('rollup-plugin-typescript2');
const { uglify } = require('rollup-plugin-uglify');

const packageJson = require('./package.json');

const NAME = 'e3kit';
const UMD_NAME = 'e3kit';

const env = process.env.ENV;
const format = process.env.FORMAT;
const minify = process.env.MINIFY === 'true';

const browser = 'browser';
const node = 'node';
const cjs = 'cjs';
const es = 'es';
const umd = 'umd';
const environment = {
  [browser]: {
    [cjs]: cjs,
    [es]: es,
    [umd]: umd,
  },
  [node]: {
    [cjs]: cjs,
    [es]: es,
  },
};

if (!environment[env]) {
  throw new TypeError(`'${env}' is not a valid environment`);
} else if (!environment[env][format]) {
  throw new TypeError(`'${format}' is not a valid module format for '${env}' environment`);
}

let external = []
if (format !== umd) {
  external = external.concat(Object.keys(packageJson.dependencies)).concat('virgil-crypto/dist/virgil-crypto-pythia.cjs');
}

function getFileName(name, environment, format, isMinified) {
  const parts = [name, environment, format];
  if (isMinified) {
    parts.push('min');
  }
  parts.push('js');
  return parts.join('.');
}

module.exports = {
  external,
  input: path.join(__dirname, 'src', 'index.ts'),
  output: {
    format,
    file: getFileName(NAME, env, format, minify),
    dir: path.join(__dirname, 'dist'),
    name: UMD_NAME
  },
  plugins: [
    resolve({ browser: format === umd }),
    commonjs(),
    typescript({
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/__mocks__/*.ts'],
      useTsconfigDeclarationDir: true,
    }),
    env === browser && inject({
      modules: {
        Buffer: ['buffer-es6', 'Buffer'],
      },
    }),
    env === browser && nodeGlobals(),
    minify && uglify(),
  ],
};
