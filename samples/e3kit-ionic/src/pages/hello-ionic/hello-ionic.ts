import { Component } from '@angular/core';
import eThree from '../../../../e3kit-sample-backend/snippets';
import { EThree } from '@virgilsecurity/e3kit';

@Component({
  selector: 'page-hello-ionic',
  templateUrl: 'hello-ionic.html'
})
export class HelloIonicPage {
  result: string;
  fetch: any;
  constructor() {
    this.result = 'waiting for test';
    let sdk: EThree;

    this.fetch = fetch.toString();
    eThree.then(client => sdk = client)
      .then(() => sdk.register())
      .then(() => sdk.encrypt('success!'))
      .then((encryptedMessage) => sdk.decrypt(encryptedMessage))
      .then((message) => this.result = message)
      .then(() => sdk.cleanup())
      .catch((error) => this.result = 'error: ' + error);
  }
}
