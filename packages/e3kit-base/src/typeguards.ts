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
