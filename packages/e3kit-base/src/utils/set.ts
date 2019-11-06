/**
 * @hidden
 */
export const setDifference = <T>(a: Set<T>, b: Set<T>) => {
    return new Set([...a].filter(it => !b.has(it)));
};
