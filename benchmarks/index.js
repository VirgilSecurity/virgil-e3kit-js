const fs = require('fs');
const path = require('path');

const getLoadTimeLines = require('./load-time');
const getPerformanceLines = require('./performance');
const getSizeLines = require('./size');

const OUTPUT_FILE = 'README.md';

(async () => {
    const loadTimeLines = await getLoadTimeLines();
    const sizeLines = getSizeLines();
    const performanceLines = getPerformanceLines();
    const lines = [
        '# Result',
        '',
        ...sizeLines,
        '',
        ...loadTimeLines,
        '',
        ...performanceLines,
    ];
    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
    console.log(`${OUTPUT_FILE} was created!`);
})();
