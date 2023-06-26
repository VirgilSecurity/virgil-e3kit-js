# Virgil E3Kit TypeScript/JavaScript

[![Build Status](https://travis-ci.com/VirgilSecurity/virgil-e3kit-js.svg?branch=master)](https://travis-ci.com/VirgilSecurity/virgil-e3kit-js)
[![npm](https://img.shields.io/npm/v/@virgilsecurity/e3kit-browser.svg)](https://www.npmjs.com/package/@virgilsecurity/e3kit-browser)
[![GitHub license](https://img.shields.io/github/license/VirgilSecurity/e3kit-js.svg)](https://github.com/VirgilSecurity/virgil-e3kit-js/blob/master/LICENSE)
[![API Reference](https://img.shields.io/badge/API%20reference-e3kit--js-green)](https://virgilsecurity.github.io/virgil-e3kit-js/)

[Introduction](#introduction) | [Benefits](#benefits) | [Features](#features) | [Installation](#installation) | [Resources](#resources) | [Samples](#samples) | [License](#license) | [Support](#support)

## Introduction

<a href="https://virgilsecurity.com/e3kit/"><img width="100px" src="https://cdn.virgilsecurity.com/assets/images/github/logos/e3kit/E3Kit.png" align="left" hspace="10" vspace="6"></a> [Virgil Security](https://virgilsecurity.com) provides [Virgil E3Kit](https://virgilsecurity.com/e3kit/) - an open-source client-side framework that allows developers to add end-to-end encryption to their messaging applications, file sharing programs, and other digital communication products in just a few simple steps to become HIPAA and GDPR compliant and more.

## Benefits

- Easy to setup and integrate into new or existing projects
- Compatible with any CPaaS provider, including Nexmo, Firebase, Twilio, PubNub and etc.
- Strong secret keys storage, integration with all platform-specific storages
- Provides GDPR and HIPAA compliance
- Immune to quantum computers attacks

## Features

- Strong one-to-one and group encryption
- Files end-to-end encryption (for browser and React Native)
- Data signature and verification as part of the encrypt and decrypt functions
- Recoverable private encryption keys
- Access to encrypted data from multiple user devices

## Installation

Navigate to our [Developer Documentation](https://developer.virgilsecurity.com/docs/e3kit/get-started/setup-client/) to install and initialize Virgil E3Kit.

Virgil E3Kit JS is provided in separate packages for different platforms:

| Name | Description |
| :--- | :---------- |
| [e3kit-browser](/packages/e3kit-browser) | For use in web browsers. |
| [e3kit-native](/packages/e3kit-native) | For use in React Native. |
| [e3kit-node](/packages/e3kit-node) | For use in Node.js and Electron. |

## Resources

- [E3Kit Product Page](https://virgilsecurity.com/e3kit/)
- [E3Kit Documentation](https://developer.virgilsecurity.com/docs/e3kit/) - start integrating E3Kit into your project with our detailed guides.
- [E3Kit TypeScript/JavaScript API Reference](https://virgilsecurity.github.io/virgil-e3kit-js/) - E3Kit API reference for the language of your choice.
- [Quickstart Demo](https://developer.virgilsecurity.com/docs/e3kit/get-started/quickstart/) - will help you to get started with the Virgil E3Kit quickly, and to learn some common ways to build end-to-end encryption between two fictional characters Alice and Bob.
 
## Samples

You can find examples for React Native, Webpack, Ionic, Node and UMD in the [examples folder](/examples), at our [Developer Documentation](https://developer.virgilsecurity.com/docs/e3kit/) and in the [E3kit Web Demo](https://github.com/VirgilSecurity/demo-e3kit-web).

## License

This library is released under the [3-clause BSD License](LICENSE).

## Support

Our developer support team is here to help you. Find out more information on our [Help Center](https://help.virgilsecurity.com/).

You can find us on [Twitter](https://twitter.com/VirgilSecurity) or send us email support@VirgilSecurity.com.

Also, get extra help from our support team on [Slack](https://virgilsecurity.com/join-community).

## Troubleshooting

### Webpack

Make sure you're following a similar approach to the [webpack example](/examples/webpack) and pay special attention to the webpack.config.js file.
