export function warn(message: string) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(message);
    }
}
