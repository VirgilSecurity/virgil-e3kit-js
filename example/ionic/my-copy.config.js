const originalConfig = require('@ionic/app-scripts/config/copy.config');
Object.assign(originalConfig, {
  copyWasm: {
    src: [
      '{{ROOT}}/node_modules/@virgilsecurity/e3kit/dist/libfoundation.browser.wasm',
      '{{ROOT}}/node_modules/@virgilsecurity/e3kit/dist/libpythia.browser.wasm'
    ],
    dest: '{{BUILD}}'
  }
})
module.exports = originalConfig;
