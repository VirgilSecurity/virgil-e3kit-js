# Virgil E3Kit SDK for Browsers
Virgil E3Kit SDK is also available on other platforms:
- [Node.js](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-node)
- [React Native](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-native)

> E3Kit's underlying crypto library is compiled to WebAssembly. You need to make sure your target browsers [support WebAssembly](https://caniuse.com/#search=WebAssembly). We also have asm.js fallback for environments that don't support WebAssembly. The downside of it is much slower download and execution time.

## Install
- npm:
  ```sh
  npm install @virgilsecurity/e3kit-browser
  ```
- yarn:
  ```sh
  yarn add @virgilsecurity/e3kit-browser
  ```
- UMD:

  **WebAssembly**
  ```html
  <script type="text/javascript" src="https://unpkg.com/@virgilsecurity/e3kit-browser@^2.1.0/dist/browser.umd.js"></script>
  ```

  **asm.js** (Use this only if your target environments don't support WebAssembly)
  ```html
  <script type="text/javascript" src="https://unpkg.com/@virgilsecurity/e3kit-browser@^2.1.0/dist/browser.asmjs.umd.js"></script>
  ```

## Use
- npm:

  **WebAssembly**

  ```javascript
  import { EThree } from '@virgilsecurity/e3kit-browser';

  // Promise
  EThree.initialize(tokenCallback)
      .then(eThree => {
          // register user, encrypt, decrypt, etc.
      });

  // async/await
  const eThree = await EThree.initialize(tokenCallback);
  // register user, encrypt, decrypt, etc.
  ```

  **asm.js** (Use this only if your target environments don't support WebAssembly)
  ```javascript
  import { EThree } from '@virgilsecurity/e3kit-browser/dist/browser.asmjs.es';

  // Promise
  EThree.initialize(tokenCallback)
      .then(eThree => {
          // register user, encrypt, decrypt, etc.
      });

  // async/await
  const eThree = await EThree.initialize(tokenCallback);
  // register user, encrypt, decrypt, etc.
  ```

- UMD:
  ```html
  <script type="text/javascript">
      const EThree = window.E3kit.EThree;

      // Promise
      EThree.initialize(tokenCallback)
          .then(eThree => {
              // register user, encrypt, decrypt, etc.
          });

      // async/await
      const eThree = await EThree.initialize(tokenCallback);
      // register user, encrypt, decrypt, etc.
  </script>
  ```

## Encrypt & decrypt large files

See the following methods if you need to encrypt & decrypt large files with the best speed/browser performance ratio:
- [authEncryptFile](https://virgilsecurity.github.io/virgil-e3kit-js/e3kit-browser/classes/ethree.html#authencryptfile)
- [authDecryptFile](https://virgilsecurity.github.io/virgil-e3kit-js/e3kit-browser/classes/ethree.html#authdecryptfile)

Both methods take an instance of `File` class as input instead of binary `ArrayBuffer`.
The files are encrypted in small chunks, so it doesn't block the main thread and it returns an encrypted instance of `File`. The chunk size by default is 64kb which produces the best speed/browser performance ratio, but it can be changed. Larger chunk size speeds up encryption but can cause browser lags.

The code sample can be found [here](https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/examples/authEncryptFile.html).

> This approach for file encryption is currently only supported in browser environments and mobile apps built with the Ionic framework.

## Further reading
You can find detailed guides on library usage [here](https://github.com/VirgilSecurity/virgil-e3kit-js#resources).

## License
This library is released under the [3-clause BSD License](LICENSE).

## Support
Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).
