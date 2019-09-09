/**
 * @hidden
 */
export function cryptoModulesLoaded(getFn: () => any) {
    try {
        getFn();
    } catch (_) {
        return false;
    }
    return true;
}
