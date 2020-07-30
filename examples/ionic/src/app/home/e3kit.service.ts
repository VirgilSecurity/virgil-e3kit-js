import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscriber } from 'rxjs';
import { EThree } from '@virgilsecurity/e3kit-browser/dist/browser.es';

interface GetJwtResponse {
    virgil_jwt: string;
}

@Injectable()
export class E3KitService {
    private static API_URL = 'http://localhost:8080';

    private httpClient: HttpClient;

    constructor(httpClient: HttpClient) {
        this.httpClient = httpClient;
    }

    runDemo(): Observable<string[]> {
        return new Observable(observer => {
            this.runDemoCode(observer);
        });
    }

    private async runDemoCode(observer: Subscriber<string[]>) {
        const messages = new Array<string>();
        try {
            const alice = await EThree.initialize(this.createGetToken('alice'));
            const bob = await EThree.initialize(this.createGetToken('bob'));

            messages.push('Alice registers...');
            observer.next(messages);
            await alice.register();

            messages.push('Alice creates private key backup...');
            observer.next(messages);
            await alice.backupPrivateKey('alice_pa$$w0rd');

            messages.push('Bob registers...');
            observer.next(messages);
            await bob.register();

            messages.push('Bob creates private key backup...');
            observer.next(messages);
            await bob.backupPrivateKey('bob_pa$$w0rd');

            messages.push("Alice searches for Bob's card...");
            observer.next(messages);
            const bobCard = await alice.findUsers(bob.identity);

            messages.push('Alice encrypts message for Bob...');
            observer.next(messages);
            const encryptedForBob = await alice.encrypt('Hello Bob!', bobCard);

            messages.push("Bob searches for Alice's card...");
            observer.next(messages);
            const aliceCard = await bob.findUsers(alice.identity);

            messages.push('Bob decrypts the message...');
            observer.next(messages);
            const decryptedByBob = await bob.decrypt(encryptedForBob, aliceCard);

            messages.push('Decrypted message: ' + decryptedByBob);
            observer.next(messages);

            const groupId = 'AliceAndBobGroup';

            messages.push('Alice creates a group with Bob...');
            observer.next(messages);
            const aliceGroup = await alice.createGroup(groupId, bobCard);

            messages.push('Alice encrypts message for the group...');
            observer.next(messages);
            const encryptedForGroup = await aliceGroup.encrypt('Hello group!');

            messages.push('Bob loads the group by ID from the Cloud...');
            observer.next(messages);
            const bobGroup = await bob.loadGroup(groupId, aliceCard);

            messages.push('Bob decrypts the group message...');
            observer.next(messages);
            const decryptedByGroup = await bobGroup.decrypt(encryptedForGroup, aliceCard);

            messages.push('Decrypted group message: ' + decryptedByGroup);
            observer.next(messages);

            messages.push('Alice deletes group...');
            observer.next(messages);
            await alice.deleteGroup(groupId);

            messages.push('Alice deletes private key backup...');
            observer.next(messages);
            await alice.resetPrivateKeyBackup();

            messages.push('Alice unregisters...');
            observer.next(messages);
            await alice.unregister();

            messages.push('Bob deletes private key backup...');
            observer.next(messages);
            await bob.resetPrivateKeyBackup();

            messages.push('Bob unregisters...');
            observer.next(messages);
            await bob.unregister();

            messages.push('Success!');
        } catch (error) {
            messages.push(error.toString());
            observer.next(messages);
        } finally {
            observer.complete();
        }
    }

    private createGetToken(identity: string) {
        return () => new Promise((resolve, reject) => {
            this.httpClient.get(`${E3KitService.API_URL}/virgil-jwt?identity=${identity}`)
                .subscribe(
                    (data: GetJwtResponse) => {
                        resolve(data.virgil_jwt);
                    },
                    error => {
                        reject(error);
                    },
                );
            });
    }
}
