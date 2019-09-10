const fs = require('fs');
const path = require('path');

const e3kitPath = path.join(__dirname, 'node_modules', '@virgilsecurity', 'e3kit');
const e3kitOldPath = path.join(__dirname, 'node_modules', '@virgilsecurity', 'e3kit-old');

const umdWasmPath = path.join(e3kitPath, 'dist', 'browser.umd.js');
const foundationPath = path.join(e3kitPath, 'dist', 'libfoundation.browser.wasm');
const pythiaPath = path.join(e3kitPath, 'dist', 'libpythia.browser.wasm');

const umdAsmjsPath = path.join(e3kitPath, 'dist', 'browser.asmjs.umd.js');
const umdOldPath = path.join(e3kitOldPath, 'dist', 'e3kit.browser.umd.min.js');

const base = filePath => path.parse(filePath).base;

const size = filePath => Math.round(fs.statSync(filePath).size / 1000);

const fileToTable = filePath => `|${base(filePath)}|${size(filePath)}|`;

const totalSize = (...files) => {
    let total = 0;
    files.forEach(file => {
        total += size(file);
    });
    return total;
};

const getSizeLines = () => [
    '## File sizes',

    '### asm.js: old vs new',
    '|File|Size (KB)|',
    '|-|-|',
    fileToTable(umdOldPath),
    fileToTable(umdAsmjsPath),
    '',

    '### WebAssembly',
    '|File|Size (KB)|',
    '|-|-|',
    fileToTable(umdWasmPath),
    fileToTable(foundationPath),
    fileToTable(pythiaPath),
    '',

    '### WebAssembly overall vs old',
    '|File|Size (KB)|',
    '|-|-|',
    `|${base(umdWasmPath)}|${totalSize(umdWasmPath, foundationPath, pythiaPath)}|`,
    fileToTable(umdOldPath),
];

module.exports = getSizeLines;
