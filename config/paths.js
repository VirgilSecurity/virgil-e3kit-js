const path = require('path');
const noPythiaCryptoPath = require.resolve('virgil-crypto');
const pythiaCryptoPath = path.resolve(noPythiaCryptoPath, '../virgil-crypto-pythia.es.js');
const pythiaCryptoBrowserPath = path.resolve(noPythiaCryptoPath, '../virgil-crypto-pythia.browser.es.js');

class Paths {
    constructor() {
        this.PLATFORM = process.env.PLATFORM || 'node';
        this.IS_BROWSER = this.PLATFORM === 'browser';
        this.NAME = 'e3kit';

        this.input = path.join(process.cwd(), 'src', 'index.ts');
        this.outputDir = path.join(process.cwd(), 'dist');

        this.formats = {
            umd: 'umd',
            es: 'es',
            cjs: 'cjs'
        }
        this.pythiaCryptoPath = this.IS_BROWSER ? pythiaCryptoBrowserPath : pythiaCryptoPath;
    }

    getFileName(format) {
        const parts = [this.NAME, this.PLATFORM, format];

        if (format === this.formats.umd) {
            parts.push('min');
        }
        const ext = (format === this.formats.es && this.PLATFORM === 'node') ? 'mjs' : 'js';
        parts.push(ext);
        return parts.join('.');
    }
}

module.exports = new Paths();
