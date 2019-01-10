import firebase from 'firebase';
import { EThree } from '@virgilsecurity/e3kit';

const getTokenFromFetchResponse = (res/*: Response */) => {
    return res.ok
        ? res.json().then((data/*: { token: string } */) => data.token)
        : Promise.reject(new Error('Error in getJWT with code: ' + res.status));
}

const fetchToken = (firebaseToken/*: string */) => fetch(
    'https://us-central1-test-test-test-e9c21.cloudfunctions.net/api/get-virgil-token',
    {
        headers: new Headers({
            'Content-Type': 'application/json',
            // Use firebase token for authentication on firebase-function backend
            Authorization: `Bearer ${firebaseToken}`,
        }),
        method: 'POST',
    },
).then(getTokenFromFetchResponse);

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        // Fetch Virgil JWT token from Firebase function
        const getToken = () => user.getIdToken().then(fetchToken);
        // Initialize EThree SDK with JWT token from Firebase Function
        EThree.initialize(getToken);
    }
});

