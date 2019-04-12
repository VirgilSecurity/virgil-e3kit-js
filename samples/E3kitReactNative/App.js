/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from 'react';
import { Platform, StyleSheet, Text, View, TextInput, Button } from 'react-native';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
import { Buffer } from 'buffer';
import { EThree } from '@virgilsecurity/e3kit';
import 'whatwg-fetch';
import EThreeStatus from './EThreeStatus';

const keyEntryStorage = createNativeKeyEntryStorage();
global.Buffer = Buffer;

const instructions = Platform.select({
    ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
    android:
        'Double tap R on your keyboard to reload,\n' + 'Shake or press menu button for dev menu',
});

const SAMPLE_BACKEND_ADDRESS = 'http://192.168.1.46:3000';

async function authenticate(identity) {
    const response = await fetch(`${SAMPLE_BACKEND_ADDRESS}/authenticate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            identity: identity,
        }),
    });
    if (!response.ok) {
        throw new Error(`Error code: ${response.status} \nMessage: ${response.statusText}`);
    }
    return response.json().then(data => data.authToken);
}

async function getVirgilToken(authToken) {
    const response = await fetch(`${SAMPLE_BACKEND_ADDRESS}/virgil-jwt`, {
        headers: {
            // We use bearer authorization, but you can use any other mechanism.
            // The point is only, this endpoint should be protected.
            Authorization: `Bearer ${authToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Error code: ${response.status} \nMessage: ${response.statusText}`);
    }

    // If request was successful we return Promise which will resolve with token string.
    return response.json().then(data => data.virgilToken);
}

export default class App extends Component {
    state = {
        username: null,
        isLogging: false,
        eThree: null,
    };

    authenticateUser = async () => {
        try {
            this.setState(state => ({ ...state, isLogging: true }));
            const authToken = await authenticate(this.state.identity);
            const eThree = await EThree.initialize(() => getVirgilToken(authToken), {
                keyEntryStorage: keyEntryStorage,
            });
            this.setState(state => ({ ...state, eThree, isLogging: false }));
        } catch (e) {
            throw e;
        }
    };

    render() {
        return (
            <View style={styles.container}>
                <Text style={styles.welcome}>Welcome to React Native!</Text>
                <Text style={styles.instructions}>To get started, edit App.js</Text>
                <Text style={styles.instructions}>{instructions}</Text>
                {this.renderLogin()}
                {this.state.message && (
                    <Text style={styles.instructions}>{this.state.message}</Text>
                )}
                {this.state.eThree && <EThreeStatus eThree={this.state.eThree} />}
            </View>
        );
    }

    renderLogin = () => {
        if (this.state.eThree) return null;
        return (
            <React.Fragment>
                <TextInput
                    style={styles.input}
                    onChangeText={text => this.setState(state => ({ ...state, identity: text }))}
                    value={this.state.identity}
                />

                <Button
                    title="login"
                    disabled={this.state.isLogging}
                    style={styles.input}
                    onPress={this.authenticateUser}
                >
                    Login
                </Button>
            </React.Fragment>
        );
    };

    renderInformation = () => {
        if (!this.state.eThree) return null;
    };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5FCFF',
    },
    welcome: {
        fontSize: 20,
        textAlign: 'center',
        margin: 10,
    },
    instructions: {
        textAlign: 'center',
        color: '#333333',
        marginBottom: 5,
    },
    input: { height: 40, width: 200, borderColor: 'gray', borderBottomWidth: 1, marginBottom: 10 },
});
