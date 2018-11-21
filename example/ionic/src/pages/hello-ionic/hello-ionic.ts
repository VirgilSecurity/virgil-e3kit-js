import { Component } from '@angular/core';
import { EThree } from '../../../../../dist/e3kit.browser.umd.min';

@Component({
  selector: 'page-hello-ionic',
  templateUrl: 'hello-ionic.html'
})
export class HelloIonicPage {
  result: string;
  fetch: any;
  constructor() {
    this.result = 'waiting for test';
    let sdk;

    const getToken = () => fetch("http://YOUR_LOCAL_IP_ADDRESS:3000/get-virgil-jwt")
      .then(res => res.json() as Promise<{ token: string }>)
      .then(data => data.token);

    this.fetch = fetch.toString();
    EThree.initalize(getToken)
      .then(client => sdk = client)
      .then(() => sdk.bootstrap('secret_password'))
      .then(() => sdk.encrypt('success!'))
      .then((encryptedMessage) => sdk.decrypt(encryptedMessage))
      .then((message) => this.result = message)
      .then(() => sdk.cleanup())
      .catch((error) => this.result = 'error: ' + error);
  }
}
