# Virgil E3Kit Typescript/Javascript SDK

[![Build Status](https://travis-ci.com/VirgilSecurity/e3kit-js.svg?branch=master)](https://travis-ci.com/VirgilSecurity)
[![npm](https://img.shields.io/npm/v/@virgilsecurity/e3kit.svg)](https://www.npmjs.com/package/@virgilsecurity/e3kit)
[![GitHub license](https://img.shields.io/github/license/VirgilSecurity/e3kit-js.svg)](https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/LICENSE)

[Introduction](#introduction) | [SDK Features](#sdk-features) | [Installation](#installation) | [Usage Example](#usage-example) | [Docs](#docs) | [Support](#support)

> Warning! This README is for the beta release of E3kit, if you're here for the latest stable version check out the [v0.6.x branch](https://github.com/VirgilSecurity/virgil-e3kit-js/tree/v0.6.x)

## Introduction

<a href="https://developer.virgilsecurity.com/docs"><img width="230px" src="https://cdn.virgilsecurity.com/assets/images/github/logos/virgil-logo-red.png" align="left" hspace="10" vspace="6"></a> [Virgil Security](https://virgilsecurity.com) provides an SDK which simplifies work with Virgil services and presents easy to use API for adding security to any application. In a few simple steps you can setup user encryption with multidevice support.

This a beta release that is made available to allow users to test and evaluate the next verion of E3kit. It is not recommended for production use at this stage.

## What's new in E3kit v0.7.1?

* The most important new feature is the ability to create secure group chats.
* Also, starting from this version E3kit is distributed as a monorepo.

## Installation

This is the root of the monorepo for E3kit, for platform-specific installation instrunctions please select the package link from below

| Name | Description |
| :--- | :---------- |
| [e3kit-browser](/packages/e3kit-browser) | For use in web browsers. |
| [e3kit-native](/packages/e3kit-native) | For use in React Native. |
| [e3kit-node](/packages/e3kit-node) | For use in Node.js and Electron. |
| [e3kit](/packages/e3kit) | This is the full `e3kit` package wrapping all of the above. It's mostly meant to preserve backward compatibility. We recommend to install one of the plaform-specific packages instead for faster install times. |

## Samples

You can find examples for React Native, Webpack, Ionic, Node and UMD in the [examples folder](/examples), on https://developer.virgilsecurity.com/docs/use-cases and in the [E3kit Web Demo](https://github.com/VirgilSecurity/demo-e3kit-web).

## Usage Example

### Initialize & Register

```javascript
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

```javascript
const usersToEncryptTo = ['alice@myapp.com', 'bob@myapp.com', 'sofia@myapp.com'];
const userWhoEncrypts = 'alex@myapp.com';
const [receiverPublicKeys, senderPublicKey] = await Promise.all([
    eThree.lookupPublicKeys(usersToEncryptTo),
    eThree.lookupPublicKeys(userWhoEncrypts)
]);

const encryptedMsg = await eThree.encrypt('Send you my sensitive information!', receiversPublicKeys);
const decryptedMsg = await eThree.decrypt(encryptedMsg, senderPublicKey);
// we decrypt the message and check that it is sent by 'alex@myapp.com'
```

### Enable Group Chat

In this section, you'll find out how to build a group chat using the Virgil E3Kit.

We assume that your users have installed and initialized the E3Kit, and used snippet above to register.


#### Create group chat

Let's imagine Alice wants to start a group chat with Bob and Carol. First, Alice creates a new group ticket by calling `createGroup` method and E3Kit stores the ticket in Virgil Cloud. This ticket holds a shared root key for future group encryption.

Alice has to specify a unique `identifier` of group with length > 10 and `findUsersResult` of participants. We recommend tying this identifier to your unique transport channel id.

```javascript
const groupId = 'unique_group_id';
const participants = await eThree.findUsers(['bob@myapp.com', 'carol@myapp.com']);
const group = await eThree.createGroup(groupId, participants);
// Group created and saved locally
```

#### Start group chat session

Now, other participants, Bob and Carol, want to join the Alice's group and have to load the group ticket using `loadGroup` method. This function requires specifying the group's `identifier` and group initiator's Card.

```javascript
const groupId = 'unique_group_id';
const aliceCard = await eThree.findUsers('alice@myapp.com');
const group = await eThree.loadGroup(groupId, aliceCard);
// Group loaded and saved locally
```

After the group is saved locally, you can use `getGroup` method to retrieve group instance from local storage.

```javascript
const groupId = 'unique_group_id';
const group = await eThree.getGroup(groupId);
```

#### Encrypt and decrypt messages

To encrypt and decrypt messages, use `encrypt` and `decrypt` methods of the group object, which allows you to work with Buffers and strings.

The following code snippet encrypts a message:

```javascript
const messageToEncrypt = 'Hello, Bob and Carol!';
const encrypted = await group.encrypt(messageToEncrypt);
// `encrypted` will be a string in base64 encoding
```

The following code snippet decrypts a message:

```javascript
const messageSenderCard = await eThree.findUsers('alice@myapp.com');
const decrypted = await group.decrypt(encrypted, messageSenderCard);
```
Note how we provide the result of `findUsers` to `decrypt` method to verify that the message hasn't been tempered with.

### Manage group chat

E3Kit allows you to add and remove participants to an existing group chat. In this version of E3Kit only the group initiator can change participants or delete a group.

#### Add new participant

To add a new chat member, the chat owner has to call the `add` method and specify the new member's Card. A new member will be able to decrypt all previous messages history.

```javascript
const newParticipant = await eThree.findUsers('john@myapp.com');
await group.add(newParticipant);
```

#### Remove participant

To remove a member, group owner has to call `remove` method and specify the member's Card. Removed participants won't be able to load or update this group.

```javascript
const existingParticipant = await eThree.findUsers('john@myapp.com');
await group.remove(existingParticipant);
```

#### Update group chat

In the event of changes in the group, e.g. new participant is added or existing participant is removed, each group chat participant has to update the encryption key by calling `update` method or reloading the group with `loadGroup`.

```javascript
await group.update();
// Group has been updated
```

#### Delete group chat

To delete a group, the owner has to call `deleteGroup` method and specify the group's `identifier`.

```javascript
await eThree.deleteGroup(groupId);
// Group has been deleted
```

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

## Troubleshooting

### Webpack

Make sure you're following a similar approach to the [webpack example](/examples/webpack) and pay special attention to the webpack.config.js file.
