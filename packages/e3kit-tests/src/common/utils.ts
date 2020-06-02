import { JwtGenerator, GeneratorJwtProvider } from 'virgil-sdk';
import { VirgilAccessTokenSigner, VirgilCrypto } from 'virgil-crypto';

export const sleep = (ms: number) =>
    new Promise(resolve => {
        setTimeout(resolve, ms);
    });

export const b64toBlob = (b64Data: string, contentType = 'text/plain', sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
};

export const getGeneratorProvider = (virgilCrypto: VirgilCrypto) => {
    const jwtGenerator = new JwtGenerator({
        appId: process.env.APP_ID!,
        apiKeyId: process.env.APP_KEY_ID!,
        apiKey: virgilCrypto.importPrivateKey(process.env.APP_KEY!),
        accessTokenSigner: new VirgilAccessTokenSigner(virgilCrypto),
    });

    return new GeneratorJwtProvider(jwtGenerator, undefined, 'default_identity');
};
