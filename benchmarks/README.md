# Result

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
|File|Load time (seconds)|
|-|-|
|browser.umd.js|3.2 s|
|browser.asmjs.umd.js|28.3 s|
|e3kit.browser.umd.min.js|23.4 s|

## Performance
You can find benchmarks for underlying crypto library [here](https://github.com/VirgilSecurity/virgil-crypto-javascript/tree/master/packages/benchmark)