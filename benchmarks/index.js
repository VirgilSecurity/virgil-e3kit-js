const fs = require('fs');
const path = require('path');

const getSizeLines = require('./size');

const OUTPUT_FILE = 'README.md';

const lines = [
    '# Result',
    ...getSizeLines(),
];

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
