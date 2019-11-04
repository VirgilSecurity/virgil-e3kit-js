# Virgil E3Kit SDK for Browsers
This package is **ONLY** for browsers. Use the following packages on other platforms:
- [React Native](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-native)
- [Node.js](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-node)

> Important! E3kit's underlying crypto library is compiled to WebAssembly, so you need to make sure that your target browsers [support WebAssembly](https://caniuse.com/#search=WebAssembly). For older browsers we have Asm.js version available but it will be slower to download and execute.

## Install
- npm:
  ```sh
  npm install @virgilsecurity/e3kit-browser@next
  ```
- yarn:
  ```sh
  yarn add @virgilsecurity/e3kit-browser@next
  ```
- UMD:
  **WebAssembly** (Recommended)
  ```html
  <script type="text/javascript" src="https://unpkg.com/@virgilsecurity/e3kit-browser@next/dist/browser.umd.js"></script>
  ```

  **Asm.js** (If you need to support older browsers)
  ```html
  <script type="text/javascript" src="https://unpkg.com/@virgilsecurity/e3kit-browser@next/dist/browser.asmjs.umd.js"></script>
  ```

## Use
- npm:
  **WebAssembly** (Recommended)

  ```javascript
  import { EThree } from '@virgilsecurirty/e3kit-browser';
  ```

  **Asm.js** (If you need to support older browsers)
  ```javascript
  import { EThree } from '@virgilsecurirty/e3kit-browser/dist/browser.asmjs.es';
  ```

- UMD:
  ```html
  <script>
      const EThree = window.E3kit.EThree;
  </script>
  ```

## Further reading
You can find detailed guide on library usage [here](https://github.com/VirgilSecurity/virgil-e3kit-js).

## License
This library is released under the [3-clause BSD License](LICENSE).

## Support
Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).
