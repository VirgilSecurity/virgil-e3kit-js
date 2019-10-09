# Virgil E3Kit Typescript/Javascript SDK

[![Build Status](https://travis-ci.com/VirgilSecurity/e3kit-js.svg?branch=master)](https://travis-ci.com/VirgilSecurity)
[![npm](https://img.shields.io/npm/v/@virgilsecurity/e3kit.svg)](https://www.npmjs.com/package/@virgilsecurity/e3kit)
[![GitHub license](https://img.shields.io/github/license/VirgilSecurity/e3kit-js.svg)](https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/LICENSE)

[Introduction](#introduction) | [SDK Features](#sdk-features) | [Installation](#installation) | [Usage Example](#usage-example) | [Docs](#docs) | [Support](#support)

> Warning! This README is for the beta release of E3kit, if you're here for the latest stable version check out the [v0.5.x branch](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/v0.5.x)

## Introduction

<a href="https://developer.virgilsecurity.com/docs"><img width="230px" src="https://cdn.virgilsecurity.com/assets/images/github/logos/virgil-logo-red.png" align="left" hspace="10" vspace="6"></a> [Virgil Security](https://virgilsecurity.com) provides an SDK which simplifies work with Virgil services and presents easy to use API for adding security to any application. In a few simple steps you can setup user encryption with multidevice support.

This a beta release that is made available to allow users to test and evaluate the next verion of E3kit. It is not recommended for production use at this stage.

## What's new in E3kit v0.6.0?

The most important changes are:
- The switch of the underlying crypto library implementation from asm.js to the more performant and smaller WebAssembly format
- Separate _native_ crypto library implementation for React Native via the JS [bridge](https://github.com/VirgilSecurity/react-native-virgil-crypto)
- Node.js support

## Installation

You can install this module from npm. Another option is to add it via script tag in browser.

### npm
You will need to install `@virgilsecurity/e3kit`:
```sh
npm install @virgilsecurity/e3kit
```

If you develop for browsers and `import` (or `require`) e3kit from the npm package, you will need to tell your module bundler (such as Webpack) to handle the `.wasm` file imports by copying them into the build output directory _preserving_ the original name.

See an example of how to do this with Webpack in the [example/webpack](example/webpack) folder.

> To serve WebAssembly in the most efficient way over the network, make sure your web server has the proper MIME type for `.wasm` files, which is `application/wasm`. That will allow streaming compilation, where the browser can start to compile code as it downloads.

### In browser via `script` tag
You will need to add `@virgilsecurity/e3kit` script.
```html
<script src="https://unpkg.com/@virgilsecurity/e3kit/dist/browser.umd.js"></script>
```

## Usage Example

### Initialize & Register

```js
import { EThree } from '@virgilsecurity/e3kit'
// get virgil token from you backend (better to protect it!)
const getToken = () => fetch('http://localhost:3000/get-virgil-jwt/')
    .then(res => res.json())
    .then(data =>  data.token);

(async function() {
    // get your unique identity from backend
    const sdk = await EThree.initialize(getToken);
    // create private key and upload it to our protected cloud service
    await sdk.register();
    await sdk.backupPrivateKey('encryption_pwd');
})();
```

### Encrypt & Decrypt

```js
const usersToEncryptTo = ["alice@myapp.com", "bob@myapp.com", 'sofia@myapp.com'];
const userWhoEncrypts = "alex@myapp.com";
const [receiverPublicKeys, senderPublicKey] = await Promise.all([
    eThree.lookupPublicKeys(usersToEncryptTo),
    eThree.lookupPublicKeys(userWhoEncrypts)
]);

const encryptedMsg = await eThree.encrypt('Send you my sensitive information!', receiversPublicKeys);
const decryptedMsg = await eThree.decrypt(encryptedMsg, senderPublicKey);
// we decrypt the message and check that it is sent by "alex@myapp.com"

```
You can find more examples in [examples folder](example) and on https://developer.virgilsecurity.com/docs/use-cases.


### Encrypt & decrypt large files

If you need to encrypt & decrypt files in the browser, see the `encryptFile` and `decryptFile` methods:
- https://virgilsecurity.github.io/virgil-e3kit-js/classes/ethree.html#encryptfile
- https://virgilsecurity.github.io/virgil-e3kit-js/classes/ethree.html#decryptfile

Both methods take an instance of `File` class as input instead of binary `ArrayBuffer`.
The files are encrypted in small chunks, so it doesn't block the main thread and it returns an encrypted instance of `File`. The chunk size by default is 64kb which produces the best speed/browser performance ratio, but it can be changed. Larger chunk size speeds up encryption but can cause browser lags.

Simple demo based on the methods above: https://virgilsecurity.github.io/virgil-e3kit-js/example/encryptFile.html
The demo source code can be found here: https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/example/encryptFile.html

> This approach for file encryption is currently only supported in browser environments and mobile apps built with the Ionic framework.


### React Native usage

This package _implicitly_ depends on [virgil-key-storage-rn](https://github.com/VirgilSecurity/virgil-key-storage-rn) to securely store private keys and [react-native-virgil-crypto](https://github.com/VirgilSecurity/react-native-virgil-crypto) as the underlying crypto library. All you have to do in your React Native project is install those two libraries and their native dependencies by following instructions in the repsective repository's README file.

Then you need to specify the `@virgilsecurity/e3kit/native` entry point when importing `EThree` and the private key storage and crypto will be initialized automatically:

```js
import { EThree } from '@virgilsecurity/e3kit/native';

EThree.initialize(getTokenCallback);
```

See the complete example in [example/E3kitReactNative](example/E3kitReactNative).

## Docs
Virgil Security has a powerful set of APIs, and the documentation below can get you started today.

* [Api Reference](https://virgilsecurity.github.io/virgil-e3kit-js/)
* [Virgil Security Documentation][_documentation]

## License
This library is released under the [3-clause BSD License](LICENSE).

## Support
Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).

[_virgil_crypto]: https://github.com/VirgilSecurity/virgil-crypto-javascript
[_virgil_sdk]: https://github.com/VirgilSecurity/virgil-sdk-javascript
[_documentation]: https://developer.virgilsecurity.com
