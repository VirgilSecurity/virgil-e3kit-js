declare module 'virgil-crypto/dist/virgil-crypto-pythia.es' {
    export * from 'virgil-crypto/dist/types/pythia';
}

declare module 'virgil-sdk/dist/virgil-sdk.cjs' {
    export * from 'virgil-sdk';
}

declare module 'virgil-pythia' {
    function createBrainKey({  }: any): any;

    export interface BrainKey {
        generateKeyPair(password: string, id?: string): Promise<any>;
    }
}
