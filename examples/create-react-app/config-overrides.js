module.exports = (config, env) => {
  // Use file-loader to copy WebAssembly files
  // https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.js#L378
  config.module.rules[2].oneOf.unshift({
    test: /\.wasm$/,
    type: 'javascript/auto',
    loader: 'file-loader',
  });
  return config;
};
