export function isArray<T = any>(val: any): val is Array<T> {
    return Array.isArray(val);
}

export const isWithoutErrors = <T>(arr: Array<T | Error>): arr is Array<T> => {
    return !arr.some((el: any) => el instanceof Error);
};
