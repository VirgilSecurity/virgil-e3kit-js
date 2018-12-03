# Changelog

## 2018-11-30 0.3.0

* Removed method EThree.boostrap(pwd)
* Method EThree.bootstrap() renamed to EThree.register()
* New method EThree.rotatePrivateKey() - used in case you lost your private key
* New method EThree.restorePrivateKey(pwd) - used to fetch private key from Virgil Cloud
* New method EThree.hasLocalPrivateKey() - used to check for private key existence on a device

## 2018-11-20 0.2.0

* Rename EThree.init method to EThree.initialize
* EThree.encrypt method now can accept single public key
* EThree.decrypt method now accept sender public key instead of array
* ЕThree.lookupPrivateKey now can lookup for one identity and return one public key.

## 2018-11-06 0.1.2

* Make `identity` property of EThree class public
* Expose instances of VirgilSDK thought `toolbox` property

## 2018-10-31 0.1.1

* Fixed bug with Ionic
* Fixed Typescript typings


## 2018-10-25 0.1.0 - Developer Preview

* First draft, implemented init, boostrap, lookupPublicKey, backupPrivateKey, resetPrivateKey, encrypt and decrypt.
* Not suitable for production
* Tested on modern browsers
