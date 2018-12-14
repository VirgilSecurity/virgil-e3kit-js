export function hasDuplicates(array: any[]) {
    return new Set(array).size !== array.length;
}

export function getObjectValues(obj: { [x: string]: any }) {
    if (Object.values) return Object.values(obj);
    return Object.keys(obj).map(function(e) {
        return obj[e];
    });
}
