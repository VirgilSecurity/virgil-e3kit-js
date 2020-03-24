# Virgil E3Kit SDK for React Native
This package is **ONLY** for React Native. Use the following packages on other platforms:
- [Browser](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-browser)
- [Node.js](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-node)

## Installation
Install `@virgilsecurity/e3kit-native`
```sh
npm install @virgilsecurity/e3kit-native
```

Also you need to install several mandatory dependencies that aren't bundled in the package:
- [react-native-virgil-crypto](https://github.com/VirgilSecurity/react-native-virgil-crypto) - Virgil Crypto Library for React Native.
- [@react-native-community/async-storage](https://github.com/react-native-community/async-storage) - storage backend for group chats.
- [@virgilsecurity/key-storage-rn](https://github.com/VirgilSecurity/virgil-key-storage-rn) - storage for Virgil Crypto's Private Keys.
- [react-native-keychain](https://github.com/oblador/react-native-keychain) - storage backend for [@virgilsecurity/key-storage-rn](https://github.com/VirgilSecurity/virgil-key-storage-rn).

> Tip: carefully follow the installation guides of each library to avoid problems in future.

## Usage
```js
import AsyncStorage from '@react-native-community/async-storage';
import { EThree } from '@virgilsecurity/e3kit-native';

EThree.initialize(getTokenCallback, { AsyncStorage })
    .then(eThree => {
        // register user, encrypt, decrypt, etc.
    })
```
> You need to explicitly pass `AsyncStorage` implementation to E3Kit. Otherwise an app will crash.

## Further reading
You can find detailed guides on library usage [here](https://github.com/VirgilSecurity/virgil-e3kit-js#resources).

## License
This library is released under the [3-clause BSD License](LICENSE).

## Support
Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).
