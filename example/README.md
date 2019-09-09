# E3kit Examples

This is a common folder for all E3kit samples. It includes a server component that is used by all of the samples to issue Virgil JWTs for authentication in Virgil Cloud.

## Get Started

- Clone the repository and install dependencies:

  ```sh
  git clone https://github.com/VirgilSecurity/virgil-e3kit-js.git
  cd virgil-e3kit-js
  npm install
  ```

  > Note, that `npm install` above can take a while as it will also create the bundles for all of the supported plaforms.

- Call `npm link` in the root folder to create a global symlimk to the `@virgilsecurity/e3kit` package, which will allow you to use it in the samples without installing:

  ```sh
  npm link
  ```

- Go the the `example` directory, install dependencies and link the `@virgilsecurity/e3kit` package:

  ```
  cd example
  npm install
  npm link @virgilsecurity/e3kit
  ```

- Create an Application and an API Key in your [Virgil Dashboard](https://dashboard.virgilsecurity.com) account.
- Create a file named `.env` in the `example` folder (you can use the contents of [.env.example](.env.example) as a starting point)

  ```sh
  cp .env.example .env
  ```
- Set your Application Id, API Key Id and API Key value as the respective values in the `.env` file

- Start the server

  ```sh
  npm run serve
  ```

- Pick an example to continue with from the subfolders of the `example` folder and follow the instructions in it's README.md file
