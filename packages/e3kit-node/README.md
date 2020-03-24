# Virgil E3Kit SDK for Node.js
This package is **ONLY** for Node.js. Use the following packages on other platforms:
- [Browser](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-browser)
- [React Native](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/master/packages/e3kit-native)

> Minimum supported version of Node.js is `8.6.0`.

## Install
- npm:
  ```sh
  npm install @virgilsecurity/e3kit-node
  ```
- yarn:
  ```sh
  yarn add @virgilsecurity/e3kit-node
  ```

## Use

```javascript
import { EThree } from '@virgilsecurity/e3kit-node';

EThree.initialize(getTokenCallback)
    .then(eThree => {
        // register user, encrypt, decrypt, etc.
    });
```

## Further reading
You can find detailed guides on library usage [here](https://github.com/VirgilSecurity/virgil-e3kit-js#resources).

## License
This library is released under the [3-clause BSD License](LICENSE).

## Support
Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).
