# Virgil E3Kit Typescript/Javascript SDK

[![Build Status](https://travis-ci.com/VirgilSecurity/e3kit-js.svg?branch=master)](https://travis-ci.com/VirgilSecurity)
[![npm](https://img.shields.io/npm/v/@virgilsecurity/e3kit.svg)](https://www.npmjs.com/package/@virgilsecurity/e3kit)
[![GitHub license](https://img.shields.io/github/license/VirgilSecurity/e3kit-js.svg)](https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/LICENSE)

[Introduction](#introduction) | [SDK Features](#sdk-features) | [Installation](#installation) | [Usage Example](#usage-example) | [Docs](#docs) | [Support](#support)

## Introduction

<a href="https://developer.virgilsecurity.com/docs"><img width="230px" src="https://cdn.virgilsecurity.com/assets/images/github/logos/virgil-logo-red.png" align="left" hspace="10" vspace="6"></a> [Virgil Security](https://virgilsecurity.com) provides an SDK which simplifies work with Virgil services and presents easy to use API for adding security to any application. In a few simple steps you can setup user encryption with multidevice support.

## SDK Features
- multidevice support
- manage users' Public Keys

## Installation

You can install this module from npm. Another option is to add it via script tag in browser.

### npm
You will need to install `@virgilsecurity/e3kit`.
```sh
npm install @virgilsecurity/e3kit
```

### In browser via `script` tag
You will need to add `@virgilsecurity/e3kit` script.
```html
<script src="https://unpkg.com/@virgilsecurity/e3kit/dist/e3kit.browser.umd.js"></script>
```

## Usage Example

### Initialize & Register

```js
import { EThree } from '@virgilsecurity/e3kit-js'
// get virgil token from you backend (better to protect it!)
const getToken = () => fetch('http://localhost:3000/get-virgil-jwt/')
    .then(res => res.json())
    .then(data =>  data.token);

// get your unique identity from backend
const sdk = await EThree.initialize(getToken);
// create private key and upload it to our protected cloud service
await sdk.register();
await sdk.backupPrivateKey('encryption_pwd');
```

### Encrypt & Decrypt

```js
const usersToEncryptTo = ["alice@myapp.com", "bob@myapp.com", 'sofia@myapp.com'];
const userThatEncrypts = "alex@myapp.com";
const [receiverPublicKeys, senderPublicKey] = await Promise.all([
    eThree.lookupPublicKeys(usersToEncryptTo),
    eThree.lookupPublicKeys(userThatEncrypts)
]);

const encryptedMsg = await eThree.encrypt('Send you my sensitive information!', receiversPublicKeys);
const decryptedMsg = await eThree.decrypt(encryptedMsg, senderPublicKey);
// we decrypt the message and check that it is sent by "alex@myapp.com"

```
You can find more examples in [examples folder](example) and on https://e3kit.readme.io.


### React Native usage

This package works with https://github.com/VirgilSecurity/virgil-key-storage-rn

```js
import { EThree } from '@virgilsecurity/e3kit';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
// or
import createExpoKeyEntryStorage from '@virgilsecurity/key-storage-rn/expo';

const keyEntryStorage = createNativeKeyEntryStorage();
// or
const keyEntryStorage = createExpoKeyEntryStorage();

EThree.initialize(getTokenCallback, { keyEntryStorage });
```

## Docs
Virgil Security has a powerful set of APIs, and the documentation below can get you started today.

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
