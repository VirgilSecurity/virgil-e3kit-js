const fs = require('fs');
const path = require('path');

const getPerformanceLines = require('./performance');
const getSizeLines = require('./size');

const OUTPUT_FILE = 'README.md';

const lines = [
    '# Result',
    ...getSizeLines(),
    ...getPerformanceLines(),
];

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
