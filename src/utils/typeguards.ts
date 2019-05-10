import { VirgilPublicKey } from 'virgil-crypto';

/**
 * @hidden
 */
export const isArray = <T = any>(val: any): val is Array<T> => {
    return Array.isArray(val);
};

/**
 * @hidden
 */
export const isWithoutErrors = <T>(arr: Array<T | Error>): arr is Array<T> => {
    return !arr.some((el: any) => el instanceof Error);
};

/**
 * @hidden
 */
export const isString = (val: any): val is string => {
    return typeof val === 'string';
};
/**
 * @hidden
 */
export const isVirgilPublicKey = (val: Object): val is VirgilPublicKey => {
    return Boolean(val) && 'identifier' in val && 'key' in val;
};
