/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isFile = (val: any): val is File => {
    return val instanceof File;
};
