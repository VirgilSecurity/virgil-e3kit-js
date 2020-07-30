/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component, Fragment } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    ScrollView,
    View,
    Text,
    StatusBar,
    Platform,
    Button,
} from 'react-native';
import { Header, Colors } from 'react-native/Libraries/NewAppScreen';
import AsyncStorage from '@react-native-community/async-storage';
import { EThree } from '@virgilsecurity/e3kit-native';

const apiUrl = `http://${
    Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
}:8080`;

const getRandomString = (prefix = '') =>
    `${prefix}${Math.random()
        .toString(36)
        .substr(2)}`;

const getTokenFactory = identity => {
    return () =>
        fetch(`${apiUrl}/virgil-jwt?identity=${encodeURIComponent(identity)}`)
            .then(res => res.json())
            .then(data => data.virgil_jwt);
};

const initializeUser = () => {
    const identity = getRandomString('E3kitReactNativeTestIdenity');
    const getToken = getTokenFactory(identity);
    return EThree.initialize(getToken, { AsyncStorage });
};

export default class App extends Component {
    state = {
        steps: [],
        error: null,
    };

    reportStep(step) {
        this.setState(({ steps }) => ({ steps: steps.concat(step) }));
    }

    async runDemo() {
        try {
            this.reportStep('Initializing...');
            const [alice, bob] = await Promise.all([
                initializeUser(),
                initializeUser(),
            ]);

            this.reportStep('Alice registers...');
            await alice.register();

            this.reportStep('Alice creates private key backup...');
            await alice.backupPrivateKey('alice_pa$$w0rd');

            this.reportStep('Bob registers...');
            await bob.register();

            this.reportStep('Bob creates private key backup...');
            await bob.backupPrivateKey('bob_pa$$w0rd');

            this.reportStep("Alice searches for Bob's card...");
            const bobCard = await alice.findUsers(bob.identity);

            this.reportStep('Alice encrypts message for Bob...');
            const encryptedForBob = await alice.authEncrypt(
                'Hello Bob!',
                bobCard,
            );

            this.reportStep("Bob searches for Alice's card...");
            const aliceCard = await bob.findUsers(alice.identity);

            this.reportStep('Bob decrypts the message...');
            const decryptedByBob = await bob.authDecrypt(
                encryptedForBob,
                aliceCard,
            );

            this.reportStep('Decrypted message: ' + decryptedByBob);

            const groupId = getRandomString('E3kitReactNativeTestGroup');

            this.reportStep('Alice creates a group with Bob...');
            const aliceGroup = await alice.createGroup(groupId, bobCard);

            this.reportStep('Alice encrypts message for the group...');
            const encryptedForGroup = await aliceGroup.encrypt('Hello group!');

            this.reportStep('Bob loads the group by ID from the Cloud...');
            const bobGroup = await bob.loadGroup(groupId, aliceCard);

            this.reportStep('Bob decrypts the group message...');
            const decryptedByGroup = await bobGroup.decrypt(
                encryptedForGroup,
                aliceCard,
            );

            this.reportStep('Decrypted group message: ' + decryptedByGroup);

            this.reportStep('Alice deletes group...');
            await alice.deleteGroup(groupId);

            this.reportStep('Alice deletes private key backup...');
            await alice.resetPrivateKeyBackup();

            this.reportStep('Alice unregisters...');
            await alice.unregister();

            this.reportStep('Bob deletes private key backup...');
            await bob.resetPrivateKeyBackup();

            this.reportStep('Bob unregisters...');
            await bob.unregister();

            this.reportStep('Success!');
        } catch (err) {
            console.error(err);
            this.setState({ error: err.toString() });
        }
    }

    render() {
        return (
            <Fragment>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}>
                        <Header />
                        {global.HermesInternal == null ? null : (
                            <View style={styles.engine}>
                                <Text style={styles.footer}>
                                    Engine: Hermes
                                </Text>
                            </View>
                        )}
                        <View style={styles.body}>
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    E3kit React Native
                                </Text>
                                <Text style={styles.sectionDescription}>
                                    Tap the button below to run the demo. If
                                    goes well, you should see status messages
                                    printed below...
                                </Text>
                                <Button
                                    title="Run demo"
                                    onPress={() => this.runDemo()}
                                />
                                {this.state.steps.map((step, i) => (
                                    <Text key={i} style={styles.highlight}>
                                        {step}
                                    </Text>
                                ))}
                                {this.state.error && (
                                    <Text style={styles.highlight}>
                                        {this.state.error}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Fragment>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        backgroundColor: Colors.lighter,
    },
    engine: {
        position: 'absolute',
        right: 0,
    },
    body: {
        backgroundColor: Colors.white,
    },
    sectionContainer: {
        marginTop: 32,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: Colors.black,
    },
    sectionDescription: {
        marginVertical: 8,
        fontSize: 18,
        fontWeight: '400',
        color: Colors.dark,
    },
    highlight: {
        fontWeight: '700',
    },
});
