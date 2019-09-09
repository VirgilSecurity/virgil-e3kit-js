# E3kit + ReactNative

Sample project demonstrating the usage of `@virgilsecurity/e3kit` in React Native projects.

## Get Started

- Start the server in the root `example` folder following instructions in `example/README.md`.

- Move to this directory and install dependencies

  ```sh
  cd example/E3kitReactNative
  yarn install
  ```

- Since React Native does not support symlinked packages, `@virgilsecurity/e3kit` had to be installed from file system. When installed from file system, the package folder in `node_modules` includes the `node_modules` and `example` folders which can lead to build errors when you try to run the project, so we need to remove those folders

  ```sh
  rm -rf node_modules/\@virgilsecurity/e3kit/example/
  rm -rf node_modules/\@virgilsecurity/e3kit/node_modules/
  ```

- Unfortunatelly, the Virgil Crypto library for iOS cannot be used with React Native 0.60.x until [this PR](https://github.com/facebook/react-native/pull/25619) makes it into a release. So to be able to run this sample in iOS, you'll need to install [Carthage](https://github.com/Carthage/Carthage).

- Install iOS dependencies
  ```sh
  cd ios
  pod install
  carthage update --platform iOS
  ```

- If you target iOS, link the `react-native-virgil-crypto` library [manually in XCode](https://github.com/VirgilSecurity/react-native-virgil-crypto#manual-installation)

- Run the project as you normally would:

  ```sh
  react-native run-android
  ```

  ```sh
  react-native run-ios
  ```

Check the `componentDidMount` method [App.js](App.js) file to see what this sample does.
