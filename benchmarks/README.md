## File sizes
### asm.js: old vs new
|File|Size (bytes)|
|-|-|
|e3kit.browser.umd.min.js|3961059|
|browser.asmjs.umd.js|4772596|

### WebAssembly
|File|Size (bytes)|
|-|-|
|browser.umd.js|414221|
|libfoundation.browser.wasm|390713|
|libpythia.browser.wasm|817573|

### WebAssembly overall vs old
|File|Size (bytes)|
|-|-|
|browser.umd.js|1622507|
|e3kit.browser.umd.min.js|3961059|

## Load time
|Type|Load time (seconds)|
|-|-|
|WebAssembly|3.2 s|
|new asm.js|28.5 s|
|old asm.js|23.3 s|

## Performance
You can find benchmarks for underlying crypto library [here](https://github.com/VirgilSecurity/virgil-crypto-javascript/tree/master/packages/benchmark)