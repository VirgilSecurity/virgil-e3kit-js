import { Component } from '@angular/core';
import { EThree } from '@virgilsecurity/e3kit/dist/browser.es';

const API_URL = 'http://localhost:8080';
const VIRGIL_API_URL: string | undefined = 'https://api.virgilsecurity.com';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
})
export class HomePage {
    result: string;

    constructor() {
        (async () => {
            try {
                const sdk = await EThree.initialize(HomePage.getToken, {
                    apiUrl: VIRGIL_API_URL,
                });
                await sdk.register();
                await sdk.backupPrivateKey('pa$$w0rd');
                const encryptedMessage = await sdk.encrypt('Success');
                this.result = (await sdk.decrypt(encryptedMessage)) as string;
            } catch (error) {
                this.result = error.toString();
            }
        })();
    }

    static async getToken() {
        const myIdentity = 'my-identity';
        const response = await fetch(`${API_URL}/virgil-jwt?identity=${myIdentity}`);
        const { virgil_jwt: virgilJwt } = await response.json();
        return virgilJwt;
    }
}
