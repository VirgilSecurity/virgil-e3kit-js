/**
 * @hidden
 */
export function hasDuplicates<T>(array: T[]) {
    return new Set(array).size !== array.length;
}

/**
 * @hidden
 */
export function getObjectValues<T = any>(obj: { [x: string]: T }): T[] {
    if (Object.values) return Object.values(obj);
    return Object.keys(obj).map(function(e) {
        return obj[e];
    });
}

/**
 * @hidden
 *
 * Splits the `array` into separate chunks of the specified `size`
 *
 * @param array
 * @param size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    size = Math.max(size, 0);
    const length = array == null ? 0 : array.length;
    if (!length || size < 1) {
        return [];
    }
    let index = 0;
    let resIndex = 0;
    const result = Array(Math.ceil(length / size));

    while (index < length) {
        result[resIndex++] = array.slice(index, (index += size));
    }

    return result;
}
