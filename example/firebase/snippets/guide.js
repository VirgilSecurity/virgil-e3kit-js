import firebase from 'firebase';
import { EThree } from '@virgilsecurity/e3kit';

// Change YOUR_FIREBASE_FUNCTION_URL to your value from firebase project
const CLOUD_FUNCTION_ENDPOINT = 'https://us-central1-test-test-test-e9c21.cloudfunctions.net/api/virgil-jwt';

// Initialization callback that returns a Virgil JWT string from the E3kit firebase function
async function fetchToken(authToken) {
    const response = await fetch(
        CLOUD_FUNCTION_ENDPOINT,
        {
            headers: new Headers({
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            })
        },
    );
    if (!response.ok) {
        throw `Error code: ${response.status} \nMessage: ${response.statusText}`;
    }
    return response.json().then(data => data.token);
};

// Once Firebase user authenticated, we wait for eThree client initialization
let eThreePromise = new Promise((resolve, reject) => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            const getToken = () => user.getIdToken().then(fetchToken);
            eThreePromise = EThree.initialize(getToken);
            eThreePromise.then(resolve).catch(reject);
        } else {
            // If user signs out, we clean his private key on device
            eThreePromise.then(eThree => eThree.cleanup());
        }
    });
});

// Call this function for each user
async function registerUser(email, pwd) {
    // Once Firebase user authenticated, we waiting for eThree client initialization
    const user = await firebase.auth().createUserWithEmailAndPassword(email, pwd);
    const eThree = await eThreePromise;
    // Register a user on Virgil Cloud with an identity received at the ЕThree.initialize step
    await eThree.register();
    await eThree.backupPrivateKey(pwd);
    return eThree;
}

// Call this function to encrypt a message
async function encryptMessage(message, chatRoomParticipants) {
    // getUsersUidSomehow is a function that returns an array of users uid strings
    const usersToEncryptTo = [...getUsersUidSomehow(chatRoomParticipants)];
    const publicKeys = await eThree.lookupPublicKeys(usersToEncryptTo);
    return eThree.encrypt(message, publicKeys);
}

// Call this function to decrypt a message
async function decryptMessage(encryptedMessage, sender) {
    // getUserUidSomehow is a function that returns a user uid string;
    const usersThatEncrypt = getUserUidSomehow(sender);
    const publicKey = await eThree.lookupPublicKeys(usersThatEncrypt);
    return eThree.decrypt(encryptedMessage, publicKey);
}
