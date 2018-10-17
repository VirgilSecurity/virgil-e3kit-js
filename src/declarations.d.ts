declare module 'virgil-crypto/dist/virgil-crypto-pythia.cjs' {
    export * from 'virgil-crypto/dist/types/pythia';
  }

declare module 'virgil-pythia' {

    function createBrainKey({}: any): any;

    export interface BrainKey {
        generateKeyPair(password: string, id?: string): Promise<any>
    }
}
