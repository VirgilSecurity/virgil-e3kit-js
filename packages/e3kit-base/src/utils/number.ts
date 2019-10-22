/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isInteger = (val: any): val is number => {
    if (Number.isInteger) return Number.isInteger(val);
    return typeof val === 'number' && isFinite(val) && Math.floor(val) === val;
};

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSafeInteger = (val: any): val is number => {
    if (Number.isSafeInteger) return Number.isSafeInteger(val);
    return isInteger(val) && Math.abs(val) <= Number.MAX_SAFE_INTEGER;
};

/**
 * @hidden
 */
export const isNumberInRange = (num: number, range: [number, number]) => {
    return typeof num === 'number' && num >= range[0] && num <= range[1];
};
