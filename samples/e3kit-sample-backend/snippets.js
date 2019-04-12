import { EThree } from '@virgilsecurity/e3kit';
// This function returns a token that will be used to authenticate requests
// to your backend.
// This is a simplified solution without any real protection, so here you need use your
// application authentication mechanism.
export async function authenticate(identity) {
    const response = await fetch('http://localhost:3000/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            identity: identity
        })
    });
    if (!response.ok) {
        throw new Error(`Error code: ${response.status} \nMessage: ${response.statusText}`);
    }
    return response.json().then(data => data.authToken);
}

export async function getVirgilToken(authToken) {
    const response = await fetch('http://localhost:3000/virgil-jwt', {
        headers: {
            // We use bearer authorization, but you can use any other mechanism.
            // The point is only, this endpoint should be protected.
            Authorization: `Bearer ${authToken}`,
        }
    })
    if (!response.ok) {
        throw new Error(`Error code: ${response.status} \nMessage: ${response.statusText}`);
    }

    // If request was successful we return Promise which will resolve with token string.
    return response.json().then(data => data.virgilToken);
}

export const getEThreeInstance = (identity, options) => authenticate(identity).then(authToken => {
    // E3kit will call this callback function and wait for the Promise resolve.
    // When it receives Virgil JWT it can do authorized requests to Virgil Cloud.
    // E3kit uses the identity encoded in the JWT as the current user's identity.
    return EThree.initialize(() => getVirgilToken(authToken), options);

    // This function makes authenticated request to GET /virgil-jwt endpoint
    // The token it returns serves to make authenticated requests to Virgil Cloud
});

export default getEThreeInstance;
