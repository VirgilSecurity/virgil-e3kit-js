const path = require('path');

const generateCrossPlatformPath = (...args) => {
    let result = path.join.apply(null, args);

    if (process.platform === 'win32') {
        result = result.replace(/\\/g, '/');
    }

    return result;
};

module.exports = { generateCrossPlatformPath };
