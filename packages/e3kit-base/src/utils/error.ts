/**
 * @hidden
 */
export const throwGetTokenNotAFunction = (typeofArg: string) => {
    throw new TypeError(
        `EThree.initialize expects a function that returns Virgil JWT, got ${typeofArg}`,
    );
};

/**
 * @hidden
 */
export const throwIllegalInvocationError = (method: string) => {
    throw new Error(`Calling ${method} two or more times in a row is not allowed.`);
};
