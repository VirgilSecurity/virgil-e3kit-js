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
} from 'react-native';

import { Header, Colors } from 'react-native/Libraries/NewAppScreen';

import { EThree } from '@virgilsecurity/e3kit-native';
import AsyncStorage from '@react-native-community/async-storage';

// variable that will hold the initialized EThree instance
let sdk;

export default class App extends Component {
    state = {
        message: null,
        keysBefore: null,
        keysAfter: null,
    };

    componentDidMount() {
        const identity =
            'E3kitReactNativeTestIdenity' +
            Math.random()
                .toString(36)
                .substr(2);
        const apiUrl = `http://${
            Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
        }:8080`;
        const getToken = () =>
            fetch(
                `${apiUrl}/virgil-jwt?identity=${encodeURIComponent(identity)}`,
            )
                .then(res => res.json())
                .then(data => data.virgil_jwt);

        const existingUserIdentity = 'E3kitReactNativeTestIdenity9fux8ceis86';
        const groupId =
            'E3kitReactNativeTestGroup' +
            Math.random()
                .toString(36)
                .substr(2);
        let group;

        EThree.initialize(getToken)
            .then(client => (sdk = client))
            .then(() => sdk.register())
            .then(() => sdk.backupPrivateKey('pa$$w0rd'))
            .then(() => sdk.encrypt('success!'))
            .then(encryptedMessage => sdk.decrypt(encryptedMessage))
            .then(message => this.setState({ message: message }))
            .then(() => sdk.findUsers(existingUserIdentity))
            .then(existingUser => sdk.createGroup(groupId, existingUser))
            .then(created => (group = created))
            .then(() => group.encrypt('group success!'))
            .then(encrypted =>
                sdk
                    .findUsers(identity)
                    .then(selfCard => ({ encrypted, selfCard })),
            )
            .then(({ encrypted, selfCard }) =>
                group.decrypt(encrypted, selfCard),
            )
            .then(message => this.setState({ message: message.toString() }))
            .then(() => AsyncStorage.getAllKeys())
            .then(keys => console.log('KEYS BEFORE', keys))
            .then(() => sdk.resetPrivateKeyBackup('pa$$w0rd'))
            .then(() => sdk.cleanup())
            .then(() => AsyncStorage.getAllKeys())
            .then(keys => console.log('KEYS AFTER', keys))
            .catch(error => {
                this.setState({ message: error.toString() });
            });
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
                                    If all goes well, you should see "success!"
                                    message printed below...
                                </Text>
                                <Text style={styles.highlight}>
                                    {this.state.message}
                                </Text>
                                {this.state.keysBefore && (
                                    <Text>
                                        {this.state.keysBefore.join(', ')}
                                    </Text>
                                )}
                                {this.state.keysAfter && (
                                    <Text>
                                        {this.state.keysAfter.join(', ')}
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
