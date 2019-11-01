# Virgil E3Kit SDK for React Native

## Installation

This module is available on NPM as `@virgilsecurity/e3kit-native`. To install this beta version the `@next` tag must be specified:

```sh
npm install @virgilsecurity/e3kit@next
```

> Note the `@next` suffix, it's important.

There are several dependencies that are required for correct E3kit functioning in React Native but aren't bundled in the package as dependencies.
You'll need to install these dependencies yourself:

* [@react-native-community/async-storage](https://github.com/react-native-community/async-storage) - Used as storage backend for group chats. Optional. React Native's [own AsyncStorage](https://facebook.github.io/react-native/docs/asyncstorage) can also be used.
* [@virgilsecurity/key-storage-rn](https://github.com/VirgilSecurity/virgil-key-storage-rn) - Used as storage for private keys
* [react-native-keychain](https://github.com/oblador/react-native-keychain) - Storage backend for `@virgilsecurity/key-storage-rn`
* [react-native-virgil-crypto](https://github.com/VirgilSecurity/react-native-virgil-crypto) - Native Crypto Library bridge. **Important!** The minimum supported version of `react-native-virgil-crypto` is **0.4.0**.

```sh
npm install @react-native-community/async-storage @virgilsecurity/key-storage-rn react-native-keychain react-native-virgil-crypto
```

## Usage

Since version 0.7.0 you need to pass your `AsyncStorage` implementation in

```js
import AsyncStorage from '@react-native-community/async-storage';
import { EThree } from '@virgilsecurity/e3kit-native';

EThree.initialize(getTokenCallback, { AsyncStorage })
.then(eThree => {
    // register user, encrypt, decrypt, etc.
})
```

See more usage examples in the [repository root]() and in sample React Native project in [examples/ReactNativeSample](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/examples/ReactNativeSample).


