## File sizes
### asm.js: old vs new
|File|Size (KB)|
|-|-|
|e3kit.browser.umd.min.js|3961|
|browser.asmjs.umd.js|4773|

### WebAssembly
|File|Size (KB)|
|-|-|
|browser.umd.js|414|
|libfoundation.browser.wasm|391|
|libpythia.browser.wasm|818|

### WebAssembly overall vs old
|File|Size (KB)|
|-|-|
|browser.umd.js|1623|
|e3kit.browser.umd.min.js|3961|

## Load time
|Type|Load time (seconds)|
|-|-|
|WebAssembly|3.2 s|
|new asm.js|28.3 s|
|old asm.js|23.3 s|

## Performance
You can find benchmarks for underlying crypto library [here](https://github.com/VirgilSecurity/virgil-crypto-javascript/tree/master/packages/benchmark)