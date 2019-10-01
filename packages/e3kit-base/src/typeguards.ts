import { ICard, FindUsersResult, LookupResult } from './types';
import { getObjectValues } from './array';

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isArray = <T = any>(val: any): val is Array<T> => {
    return Array.isArray(val);
};

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isString = (val: any): val is string => {
    return typeof val === 'string';
};

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObject(obj: any) {
    return typeof obj === 'object' && obj !== null;
}

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isVirgilCard(obj: any): obj is ICard {
    return isObject(obj) && 'identity' in obj && 'publicKey' in obj;
}

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFindUsersResult(obj: any): obj is FindUsersResult {
    if (!isObject(obj)) return false;

    const values = getObjectValues(obj);
    if (values.length === 0) return false;

    return values.every(val => isVirgilCard(val));
}

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isLookupResult(
    obj: any,
    isPublicKeyFn: (obj: any) => boolean,
): obj is LookupResult {
    if (!isObject(obj)) return false;

    const values = getObjectValues(obj);
    if (values.length === 0) return false;

    return values.every(val => isPublicKeyFn(val));
}
