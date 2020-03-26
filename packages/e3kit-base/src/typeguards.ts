/* eslint-disable @typescript-eslint/no-explicit-any */
import { ICard, FindUsersResult } from './types';
import { getObjectValues } from './array';

/**
 * @hidden
 */
export const isArray = <T = any>(val: any): val is Array<T> => {
    return Array.isArray(val);
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
export function isObject(obj: any) {
    return typeof obj === 'object' && obj !== null;
}

/**
 * @hidden
 */
export function isVirgilCard(obj: any): obj is ICard {
    return isObject(obj) && 'identity' in obj && 'publicKey' in obj;
}

/**
 * @hidden
 */
export function isFindUsersResult(obj: any): obj is FindUsersResult {
    if (!isObject(obj)) return false;

    const values = getObjectValues(obj);
    if (values.length === 0) return false;

    return values.every(val => isVirgilCard(val));
}
