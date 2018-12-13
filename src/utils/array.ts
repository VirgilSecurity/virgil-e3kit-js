export function hasDuplicates(array: any[]) {
    return new Set(array).size !== array.length;
}
