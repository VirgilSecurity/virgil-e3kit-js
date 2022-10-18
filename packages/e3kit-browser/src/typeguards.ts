/**
 * @hidden
 */
export const isFile = (val: any): val is File => {
    return val instanceof File;
};
