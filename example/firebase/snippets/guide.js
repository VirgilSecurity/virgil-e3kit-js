import firebase from 'firebase';
import { EThree } from '../../../dist/e3kit.browser.umd.js';

const getTokenFromFetchResponse = (res/*: Response */) => {
    return res.ok
        ? res.json().then((data/*: { token: string } */) => data.token)
        : Promise.reject(new Error('Error in getJWT with code: ' + res.status));
}

const fetchToken = (token/*: string */) => fetch(
    'https://us-central1-test-test-test-e9c21.cloudfunctions.net/api/get-virgil-token',
    {
        headers: new Headers({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        }),
        method: 'POST',
    },
).then(getTokenFromFetchResponse);

let eThreePromise = new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Async func to fetch Virgil JWT token from the Virgil-Firebase function
            const getToken = () => user.getIdToken().then(fetchToken);
            // Initialize e3kit - see full sample in EThree.init page
            eThreePromise = EThree.initialize(getToken);
            eThreePromise.then(resolve).catch(reject);
        } else {
            // Delete the user's private key from device when user is logout
            eThreePromise.then(eThree => eThree.cleanup());
        }
    });
});

let eThree;
// Log in Firebase user on client device
firebase.auth().signInAnonymously()
    // Once Firebase user authenticated, we waiting for eThree client initialization
    .then(() => eThreePromise)
    // Bootstrap user (i.e. load user's private key)
    .then(client => {
        eThree = client;
        eThree.bootstrap('password');
        return eThree;
    })
    // Lookup destination user public keys
    .then(eThree => {
        const usersToEncryptTo = ["alice@myapp.com", "bob@myapp.com", 'sofia@myapp.com'];
        const userThatEncrypt = ["anonymous@myapp.com"];
        return Promise.all([
            eThree.lookupPublicKeys(usersToEncryptTo),
            eThree.lookupPublicKeys(userThatEncrypt)
        ]);
    })
    // Encrypt message to chat room users
    .then(([chatRoomParticipants, senderPublicKeys]) => {
        const encryptedMsg = eThree.encrypt('Hack me!', chatRoomParticipants);
        return { encryptedMsg, senderPublicKeys }
    })
    .then(({ encryptedMsg, senderPublicKeys }) => eThree.decrypt(encryptedMsg, senderPublicKeys))
    .catch(err => console.log(err.result))

