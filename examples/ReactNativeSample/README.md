# E3kit + ReactNative

Sample project demonstrating the usage of `@virgilsecurity/e3kit-native` in React Native projects.

## Get Started

- Configure and start the server in the `examples/backend` folder following instructions in `../examples/backend/README.md`.
- Install dependencies with [Yarn](https://yarnpkg.com/en/)
  ```sh
  yarn install
  ```
  > You need to use Yarn because we use [Workspaces](https://yarnpkg.com/lang/en/docs/workspaces/) in this repository :)
- For install iOS dependencies
  ```sh
  yarn install:ios
  ```
- Run the project as you normally would:
  ```sh
  yarn android
  ```

  ```sh
  yarn ios
  ```
> ⚠️ If you see `Cannot find module '@virgilsecurity/e3kit-native'` Error, make sure you did `yarn install` in the root folder


Check the `runDemo` method in [App.js](App.js) file to see what this sample does.
