declare module 'asyncstorage-down' {
    import { AbstractLevelDOWN } from 'abstract-leveldown';

    export interface AsyncStorageDown<K, V> extends AbstractLevelDOWN<K, V> {
        readonly location: string;
    }

    export interface AsyncStorageDownConstructor {
        new <K = any, V = any>(
            location: string,
            options: { AsyncStorage: unknown },
        ): AsyncStorageDown<K, V>;
        <K = any, V = any>(location: string, options: { AsyncStorage: unknown }): AsyncStorageDown<
            K,
            V
        >;
    }

    export const AsyncStorageDown: AsyncStorageDownConstructor;
    export default AsyncStorageDown;
}
