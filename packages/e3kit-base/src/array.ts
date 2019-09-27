/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasDuplicates(array: any[]) {
    return new Set(array).size !== array.length;
}

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getObjectValues(obj: { [x: string]: any }) {
    if (Object.values) return Object.values(obj);
    return Object.keys(obj).map(function(e) {
        return obj[e];
    });
}
