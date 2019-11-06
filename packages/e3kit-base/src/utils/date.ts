const DATE_TAG = '[object Date]';
const toString = Object.prototype.toString;

/**
 * @hidden
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidDate(date: any): date is Date {
    return date && toString.call(date) === DATE_TAG && !isNaN(date);
}
