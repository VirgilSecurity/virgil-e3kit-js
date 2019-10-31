/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 * Borrows heavily from https://github.com/invertase/react-native-firebase/blob/master/tests/metro.config.js
 *
 * @format
 */

const { resolve, join, basename, dirname } = require('path');
const { readdirSync, statSync } = require('fs');

const { createBlacklist } = require('metro');

const rootDir = resolve(__dirname, '../..');
const packagesDir = resolve(rootDir, 'packages');

const isDirectory = source => statSync(source).isDirectory();
const virgilModules = readdirSync(packagesDir)
    .map(name => join(packagesDir, name))
    .filter(isDirectory);
const virgilPackageNames = virgilModules.map(path => basename(dirname(path)));

const config = {
    projectRoot: __dirname,
    resolver: {
        blackListRE: createBlacklist([
            new RegExp(
                `^${escape(
                    resolve(rootDir, 'examples/ReactNativeSample/android'),
                )}\\/.*$`,
            ),
            new RegExp(
                `^${escape(
                    resolve(rootDir, 'examples/ReactNativeSample/ios'),
                )}\\/.*$`,
            ),
            new RegExp(
                `^${escape(
                    resolve(rootDir, 'examples/ReactNativeSample/node_modules'),
                )}\\/.*$`,
            ),
        ]),
        extraNodeModules: new Proxy(
            {},
            {
                get: (target, name) => {
                    if (typeof name !== 'string') {
                        return target[name];
                    }
                    if (name && virgilPackageNames.includes(name)) {
                        const packageName = name.replace(
                            '@virgilsecurity/',
                            '',
                        );
                        return join(__dirname, `../packages/${packageName}`);
                    }
                    return join(__dirname, `node_modules/${name}`);
                },
            },
        ),
    },
    watchFolders: [...virgilModules],
};

module.exports = config;
