// Type definitions for Jest 23.3
// Project: http://facebook.github.io/jest/
// Definitions by: Asana <https://asana.com>
//                 Ivo Stratev <https://github.com/NoHomey>
//                 jwbay <https://github.com/jwbay>
//                 Alexey Svetliakov <https://github.com/asvetliakov>
//                 Alex Jover Morales <https://github.com/alexjoverm>
//                 Allan Lukwago <https://github.com/epicallan>
//                 Ika <https://github.com/ikatyang>
//                 Waseem Dahman <https://github.com/wsmd>
//                 Jamie Mason <https://github.com/JamieMason>
//                 Douglas Duteil <https://github.com/douglasduteil>
//                 Ahn <https://github.com/ahnpnl>
//                 Josh Goldberg <https://github.com/joshuakgoldberg>
//                 Jeff Lau <https://github.com/UselessPickles>
//                 Andrew Makarov <https://github.com/r3nya>
//                 Martin Hochel <https://github.com/hotell>
//                 Sebastian Sebald <https://github.com/sebald>
//                 Andy <https://github.com/andys8>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

declare module 'expect' {
    const expect: Expect;
    export default expect;

    interface MatcherUtils {
        readonly expand: boolean;
        readonly isNot: boolean;
        utils: {
            readonly EXPECTED_COLOR: (text: string) => string;
            readonly RECEIVED_COLOR: (text: string) => string;
            ensureActualIsNumber(actual: any, matcherName?: string): void;
            ensureExpectedIsNumber(actual: any, matcherName?: string): void;
            ensureNoExpected(actual: any, matcherName?: string): void;
            ensureNumbers(actual: any, expected: any, matcherName?: string): void;
            /**
             * get the type of a value with handling of edge cases like `typeof []` and `typeof null`
             */
            getType(value: any): string;
            matcherHint(
                matcherName: string,
                received?: string,
                expected?: string,
                options?: { secondArgument?: string; isDirectExpectCall?: boolean },
            ): string;
            pluralize(word: string, count: number): string;
            printExpected(value: any): string;
            printReceived(value: any): string;
            printWithType(name: string, received: any, print: (value: any) => string): string;
            stringify(object: {}, maxDepth?: number): string;
        };
        /**
         *  This is a deep-equality function that will return true if two objects have the same values (recursively).
         */
        equals(a: any, b: any): boolean;
    }

    interface ExpectExtendMap {
        [key: string]: CustomMatcher;
    }

    type CustomMatcher = (
        this: MatcherUtils,
        received: any,
        ...actual: any[]
    ) => CustomMatcherResult | Promise<CustomMatcherResult>;

    interface CustomMatcherResult {
        pass: boolean;
        message: string | (() => string);
    }

    interface SnapshotSerializerOptions {
        callToJSON?: boolean;
        edgeSpacing?: string;
        spacing?: string;
        escapeRegex?: boolean;
        highlight?: boolean;
        indent?: number;
        maxDepth?: number;
        min?: boolean;
        plugins?: SnapshotSerializerPlugin[];
        printFunctionName?: boolean;
        theme?: SnapshotSerializerOptionsTheme;

        // see https://github.com/facebook/jest/blob/e56103cf142d2e87542ddfb6bd892bcee262c0e6/types/PrettyFormat.js
    }
    interface SnapshotSerializerOptionsTheme {
        comment?: string;
        content?: string;
        prop?: string;
        tag?: string;
        value?: string;
    }
    interface SnapshotSerializerColor {
        close: string;
        open: string;
    }
    interface SnapshotSerializerColors {
        comment: SnapshotSerializerColor;
        content: SnapshotSerializerColor;
        prop: SnapshotSerializerColor;
        tag: SnapshotSerializerColor;
        value: SnapshotSerializerColor;
    }
    interface SnapshotSerializerPlugin {
        print(
            val: any,
            serialize: ((val: any) => string),
            indent: ((str: string) => string),
            opts: SnapshotSerializerOptions,
            colors: SnapshotSerializerColors,
        ): string;
        test(val: any): boolean;
    }

    interface InverseAsymmetricMatchers {
        /**
         * `expect.not.arrayContaining(array)` matches a received array which
         * does not contain all of the elements in the expected array. That is,
         * the expected array is not a subset of the received array. It is the
         * inverse of `expect.arrayContaining`.
         */
        arrayContaining(arr: any[]): any;
        /**
         * `expect.not.objectContaining(object)` matches any received object
         * that does not recursively match the expected properties. That is, the
         * expected object is not a subset of the received object. Therefore,
         * it matches a received object which contains properties that are not
         * in the expected object. It is the inverse of `expect.objectContaining`.
         */
        objectContaining(obj: {}): any;
        /**
         * `expect.not.stringMatching(string | regexp)` matches the received
         * string that does not match the expected regexp. It is the inverse of
         * `expect.stringMatching`.
         */
        stringMatching(str: string | RegExp): any;
        /**
         * `expect.not.stringContaining(string)` matches the received string
         * that does not contain the exact expected string. It is the inverse of
         * `expect.stringContaining`.
         */
        stringContaining(str: string): any;
    }

    /**
     * The `expect` function is used every time you want to test a value.
     * You will rarely call `expect` by itself.
     */
    interface Expect {
        /**
         * The `expect` function is used every time you want to test a value.
         * You will rarely call `expect` by itself.
         *
         * @param actual The value to apply matchers against.
         */
        <T = any>(actual: T): Matchers<T>;
        /**
         * Matches anything but null or undefined. You can use it inside `toEqual` or `toBeCalledWith` instead
         * of a literal value. For example, if you want to check that a mock function is called with a
         * non-null argument:
         *
         * @example
         *
         * test('map calls its argument with a non-null argument', () => {
         *   const mock = jest.fn();
         *   [1].map(x => mock(x));
         *   expect(mock).toBeCalledWith(expect.anything());
         * });
         *
         */
        anything(): any;
        /**
         * Matches anything that was created with the given constructor.
         * You can use it inside `toEqual` or `toBeCalledWith` instead of a literal value.
         *
         * @example
         *
         * function randocall(fn) {
         *   return fn(Math.floor(Math.random() * 6 + 1));
         * }
         *
         * test('randocall calls its callback with a number', () => {
         *   const mock = jest.fn();
         *   randocall(mock);
         *   expect(mock).toBeCalledWith(expect.any(Number));
         * });
         */
        any(classType: any): any;
        /**
         * Matches any array made up entirely of elements in the provided array.
         * You can use it inside `toEqual` or `toBeCalledWith` instead of a literal value.
         */
        arrayContaining(arr: any[]): any;
        /**
         * Verifies that a certain number of assertions are called during a test.
         * This is often useful when testing asynchronous code, in order to
         * make sure that assertions in a callback actually got called.
         */
        assertions(num: number): void;
        /**
         * Verifies that at least one assertion is called during a test.
         * This is often useful when testing asynchronous code, in order to
         * make sure that assertions in a callback actually got called.
         */
        hasAssertions(): void;
        /**
         * You can use `expect.extend` to add your own matchers to Jest.
         */
        extend(obj: ExpectExtendMap): void;
        /**
         * Adds a module to format application-specific data structures for serialization.
         */
        addSnapshotSerializer(serializer: SnapshotSerializerPlugin): void;
        /**
         * Matches any object that recursively matches the provided keys.
         * This is often handy in conjunction with other asymmetric matchers.
         */
        objectContaining(obj: {}): any;
        /**
         * Matches any string that contains the exact provided string
         */
        stringMatching(str: string | RegExp): any;
        /**
         * Matches any received string that contains the exact expected string
         */
        stringContaining(str: string): any;

        not: InverseAsymmetricMatchers;
    }

    interface Matchers<R> {
        /**
         * Ensures the last call to a mock function was provided specific args.
         */
        lastCalledWith(...args: any[]): R;
        /**
         * Ensure that the last call to a mock function has returned a specified value.
         */
        lastReturnedWith(value: any): R;
        /**
         * If you know how to test something, `.not` lets you test its opposite.
         */
        not: Matchers<R>;
        /**
         * Ensure that a mock function is called with specific arguments on an Nth call.
         */
        nthCalledWith(nthCall: number, ...params: any[]): R;
        /**
         * Ensure that the nth call to a mock function has returned a specified value.
         */
        nthReturnedWith(n: number, value: any): R;
        /**
         * Use resolves to unwrap the value of a fulfilled promise so any other
         * matcher can be chained. If the promise is rejected the assertion fails.
         */
        resolves: Matchers<Promise<R>>;
        /**
         * Unwraps the reason of a rejected promise so any other matcher can be chained.
         * If the promise is fulfilled the assertion fails.
         */
        rejects: Matchers<Promise<R>>;
        /**
         * Checks that a value is what you expect. It uses `===` to check strict equality.
         * Don't use `toBe` with floating-point numbers.
         */
        toBe(expected: any): R;
        /**
         * Ensures that a mock function is called.
         */
        toBeCalled(): R;
        /**
         * Ensures that a mock function is called an exact number of times.
         */
        toBeCalledTimes(expected: number): R;
        /**
         * Ensure that a mock function is called with specific arguments.
         */
        toBeCalledWith(...args: any[]): R;
        /**
         * Using exact equality with floating point numbers is a bad idea.
         * Rounding means that intuitive things fail.
         * The default for numDigits is 2.
         */
        toBeCloseTo(expected: number, numDigits?: number): R;
        /**
         * Ensure that a variable is not undefined.
         */
        toBeDefined(): R;
        /**
         * When you don't care what a value is, you just want to
         * ensure a value is false in a boolean context.
         */
        toBeFalsy(): R;
        /**
         * For comparing floating point numbers.
         */
        toBeGreaterThan(expected: number): R;
        /**
         * For comparing floating point numbers.
         */
        toBeGreaterThanOrEqual(expected: number): R;
        /**
         * Ensure that an object is an instance of a class.
         * This matcher uses `instanceof` underneath.
         */
        toBeInstanceOf(expected: any): R;
        /**
         * For comparing floating point numbers.
         */
        toBeLessThan(expected: number): R;
        /**
         * For comparing floating point numbers.
         */
        toBeLessThanOrEqual(expected: number): R;
        /**
         * This is the same as `.toBe(null)` but the error messages are a bit nicer.
         * So use `.toBeNull()` when you want to check that something is null.
         */
        toBeNull(): R;
        /**
         * Use when you don't care what a value is, you just want to ensure a value
         * is true in a boolean context. In JavaScript, there are six falsy values:
         * `false`, `0`, `''`, `null`, `undefined`, and `NaN`. Everything else is truthy.
         */
        toBeTruthy(): R;
        /**
         * Used to check that a variable is undefined.
         */
        toBeUndefined(): R;
        /**
         * Used to check that a variable is NaN.
         */
        toBeNaN(): R;
        /**
         * Used when you want to check that an item is in a list.
         * For testing the items in the list, this uses `===`, a strict equality check.
         */
        toContain(expected: any): R;
        /**
         * Used when you want to check that an item is in a list.
         * For testing the items in the list, this  matcher recursively checks the
         * equality of all fields, rather than checking for object identity.
         */
        toContainEqual(expected: any): R;
        /**
         * Used when you want to check that two objects have the same value.
         * This matcher recursively checks the equality of all fields, rather than checking for object identity.
         */
        toEqual(expected: any): R;
        /**
         * Ensures that a mock function is called.
         */
        toHaveBeenCalled(): R;
        /**
         * Ensures that a mock function is called an exact number of times.
         */
        toHaveBeenCalledTimes(expected: number): R;
        /**
         * Ensure that a mock function is called with specific arguments.
         */
        toHaveBeenCalledWith(...params: any[]): R;
        /**
         * Ensure that a mock function is called with specific arguments on an Nth call.
         */
        toHaveBeenNthCalledWith(nthCall: number, ...params: any[]): R;
        /**
         * If you have a mock function, you can use `.toHaveBeenLastCalledWith`
         * to test what arguments it was last called with.
         */
        toHaveBeenLastCalledWith(...params: any[]): R;
        /**
         * Use to test the specific value that a mock function last returned.
         * If the last call to the mock function threw an error, then this matcher will fail
         * no matter what value you provided as the expected return value.
         */
        toHaveLastReturnedWith(expected: any): R;
        /**
         * Used to check that an object has a `.length` property
         * and it is set to a certain numeric value.
         */
        toHaveLength(expected: number): R;
        /**
         * Use to test the specific value that a mock function returned for the nth call.
         * If the nth call to the mock function threw an error, then this matcher will fail
         * no matter what value you provided as the expected return value.
         */
        toHaveNthReturnedWith(nthCall: number, expected: any): R;
        /**
         * Use to check if property at provided reference keyPath exists for an object.
         * For checking deeply nested properties in an object you may use dot notation or an array containing
         * the keyPath for deep references.
         *
         * Optionally, you can provide a value to check if it's equal to the value present at keyPath
         * on the target object. This matcher uses 'deep equality' (like `toEqual()`) and recursively checks
         * the equality of all fields.
         *
         * @example
         *
         * expect(houseForSale).toHaveProperty('kitchen.area', 20);
         */
        toHaveProperty(propertyPath: string | any[], value?: any): R;
        /**
         * Use to test that the mock function successfully returned (i.e., did not throw an error) at least one time
         */
        toHaveReturned(): R;
        /**
         * Use to ensure that a mock function returned successfully (i.e., did not throw an error) an exact number of times.
         * Any calls to the mock function that throw an error are not counted toward the number of times the function returned.
         */
        toHaveReturnedTimes(expected: number): R;
        /**
         * Use to ensure that a mock function returned a specific value.
         */
        toHaveReturnedWith(expected: any): R;
        /**
         * Check that a string matches a regular expression.
         */
        toMatch(expected: string | RegExp): R;
        /**
         * Used to check that a JavaScript object matches a subset of the properties of an object
         */
        toMatchObject(expected: {} | any[]): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchSnapshot<T extends { [P in keyof R]: any }>(
            propertyMatchers: Partial<T>,
            snapshotName?: string,
        ): R;
        /**
         * This ensures that a value matches the most recent snapshot.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchSnapshot(snapshotName?: string): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchInlineSnapshot<T extends { [P in keyof R]: any }>(
            propertyMatchers: Partial<T>,
            snapshot?: string,
        ): R;
        /**
         * This ensures that a value matches the most recent snapshot with property matchers.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         * Check out [the Snapshot Testing guide](http://facebook.github.io/jest/docs/snapshot-testing.html) for more information.
         */
        toMatchInlineSnapshot(snapshot?: string): R;
        /**
         * Ensure that a mock function has returned (as opposed to thrown) at least once.
         */
        toReturn(): R;
        /**
         * Ensure that a mock function has returned (as opposed to thrown) a specified number of times.
         */
        toReturnTimes(count: number): R;
        /**
         * Ensure that a mock function has returned a specified value at least once.
         */
        toReturnWith(value: any): R;
        /**
         * Use to test that objects have the same types as well as structure.
         */
        toStrictEqual(expected: {}): R;
        /**
         * Used to test that a function throws when it is called.
         */
        toThrow(error?: string | Constructable | RegExp | Error): R;
        /**
         * If you want to test that a specific error is thrown inside a function.
         */
        toThrowError(error?: string | Constructable | RegExp | Error): R;
        /**
         * Used to test that a function throws a error matching the most recent snapshot when it is called.
         */
        toThrowErrorMatchingSnapshot(): R;
        /**
         * Used to test that a function throws a error matching the most recent snapshot when it is called.
         * Instead of writing the snapshot value to a .snap file, it will be written into the source code automatically.
         */
        toThrowErrorMatchingInlineSnapshot(snapshot?: string): R;
    }

    interface Constructable {
        new (...args: any[]): any;
    }

    interface Mock<T = {}> extends Function, MockInstance<T> {
        new (...args: any[]): T;
        (...args: any[]): any;
    }

    interface SpyInstance<T = {}> extends MockInstance<T> {}

    /**
     * Wrap module with mock definitions
     *
     * @example
     *
     *  jest.mock("../api");
     *  import { Api } from "../api";
     *
     *  const myApi: jest.Mocked<Api> = new Api() as any;
     *  myApi.myApiMethod.mockImplementation(() => "test");
     */
    type Mocked<T> = { [P in keyof T]: T[P] & MockInstance<T[P]> } & T;

    interface MockInstance<T> {
        /** Returns the mock name string set by calling `mockFn.mockName(value)`. */
        getMockName(): string;
        /** Provides access to the mock's metadata */
        mock: MockContext<T>;
        /**
         * Resets all information stored in the mockFn.mock.calls and mockFn.mock.instances arrays.
         *
         * Often this is useful when you want to clean up a mock's usage data between two assertions.
         *
         * Beware that `mockClear` will replace `mockFn.mock`, not just `mockFn.mock.calls` and `mockFn.mock.instances`.
         * You should therefore avoid assigning mockFn.mock to other variables, temporary or not, to make sure you
         * don't access stale data.
         */
        mockClear(): void;
        /**
         * Resets all information stored in the mock, including any initial implementation and mock name given.
         *
         * This is useful when you want to completely restore a mock back to its initial state.
         *
         * Beware that `mockReset` will replace `mockFn.mock`, not just `mockFn.mock.calls` and `mockFn.mock.instances`.
         * You should therefore avoid assigning mockFn.mock to other variables, temporary or not, to make sure you
         * don't access stale data.
         */
        mockReset(): void;
        /**
         * Does everything that `mockFn.mockReset()` does, and also restores the original (non-mocked) implementation.
         *
         * This is useful when you want to mock functions in certain test cases and restore the original implementation in others.
         *
         * Beware that `mockFn.mockRestore` only works when mock was created with `jest.spyOn`. Thus you have to take care of restoration
         * yourself when manually assigning `jest.fn()`.
         *
         * The [`restoreMocks`](https://jestjs.io/docs/en/configuration.html#restoremocks-boolean) configuration option is available
         * to restore mocks automatically between tests.
         */
        mockRestore(): void;
        /**
         * Accepts a function that should be used as the implementation of the mock. The mock itself will still record
         * all calls that go into and instances that come from itself – the only difference is that the implementation
         * will also be executed when the mock is called.
         *
         * Note: `jest.fn(implementation)` is a shorthand for `jest.fn().mockImplementation(implementation)`.
         */
        mockImplementation(fn?: (...args: any[]) => any): Mock<T>;
        /**
         * Accepts a function that will be used as an implementation of the mock for one call to the mocked function.
         * Can be chained so that multiple function calls produce different results.
         *
         * @example
         *
         * const myMockFn = jest
         *   .fn()
         *    .mockImplementationOnce(cb => cb(null, true))
         *    .mockImplementationOnce(cb => cb(null, false));
         *
         * myMockFn((err, val) => console.log(val)); // true
         *
         * myMockFn((err, val) => console.log(val)); // false
         */
        mockImplementationOnce(fn: (...args: any[]) => any): Mock<T>;
        /** Sets the name of the mock`. */
        mockName(name: string): Mock<T>;
        /**
         * Just a simple sugar function for:
         *
         * @example
         *
         *   jest.fn(function() {
         *     return this;
         *   });
         */
        mockReturnThis(): Mock<T>;
        /**
         * Accepts a value that will be returned whenever the mock function is called.
         *
         * @example
         *
         * const mock = jest.fn();
         * mock.mockReturnValue(42);
         * mock(); // 42
         * mock.mockReturnValue(43);
         * mock(); // 43
         */
        mockReturnValue(value: any): Mock<T>;
        /**
         * Accepts a value that will be returned for one call to the mock function. Can be chained so that
         * successive calls to the mock function return different values. When there are no more
         * `mockReturnValueOnce` values to use, calls will return a value specified by `mockReturnValue`.
         *
         * @example
         *
         * const myMockFn = jest.fn()
         *   .mockReturnValue('default')
         *   .mockReturnValueOnce('first call')
         *   .mockReturnValueOnce('second call');
         *
         * // 'first call', 'second call', 'default', 'default'
         * console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
         *
         */
        mockReturnValueOnce(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementation(() => Promise.resolve(value));`
         */
        mockResolvedValue(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementationOnce(() => Promise.resolve(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *  const asyncMock = jest
         *    .fn()
         *    .mockResolvedValue('default')
         *    .mockResolvedValueOnce('first call')
         *    .mockResolvedValueOnce('second call');
         *
         *  await asyncMock(); // first call
         *  await asyncMock(); // second call
         *  await asyncMock(); // default
         *  await asyncMock(); // default
         * });
         *
         */
        mockResolvedValueOnce(value: any): Mock<T>;
        /**
         * Simple sugar function for: `jest.fn().mockImplementation(() => Promise.reject(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *   const asyncMock = jest.fn().mockRejectedValue(new Error('Async error'));
         *
         *   await asyncMock(); // throws "Async error"
         * });
         */
        mockRejectedValue(value: any): Mock<T>;

        /**
         * Simple sugar function for: `jest.fn().mockImplementationOnce(() => Promise.reject(value));`
         *
         * @example
         *
         * test('async test', async () => {
         *  const asyncMock = jest
         *    .fn()
         *    .mockResolvedValueOnce('first call')
         *    .mockRejectedValueOnce(new Error('Async error'));
         *
         *  await asyncMock(); // first call
         *  await asyncMock(); // throws "Async error"
         * });
         *
         */
        mockRejectedValueOnce(value: any): Mock<T>;
    }

    /**
     * Represents the result of a single call to a mock function.
     */
    interface MockResult {
        /**
         * True if the function threw.
         * False if the function returned.
         */
        isThrow: boolean;
        /**
         * The value that was either thrown or returned by the function.
         */
        value: any;
    }

    interface MockContext<T> {
        calls: any[][];
        instances: T[];
        invocationCallOrder: number[];
        /**
         * List of results of calls to the mock function.
         */
        results: MockResult[];
    }
}
