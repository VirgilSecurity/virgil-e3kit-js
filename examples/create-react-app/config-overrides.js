const path = require('path');

module.exports = (config, env) => {
  // Use file-loader to copy WebAssembly files to the same directory as JavaScript
  // https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.js#L378
  config.module.rules[2].oneOf.unshift({
    test: /\.wasm$/,
    type: 'javascript/auto',
    loader: 'file-loader',
    options: {
      name: '[name].[ext]',
      outputPath: path.join('static', 'js'),
    },
  });
  return config;
};
