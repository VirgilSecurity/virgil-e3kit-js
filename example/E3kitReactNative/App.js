/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View} from 'react-native';
import { EThree } from '@virgilsecurity/e3kit';
import createNativeKeyEntryStorage from '@virgilsecurity/key-storage-rn/native';
const keyEntryStorage = createNativeKeyEntryStorage();
import 'whatwg-fetch';
import 'es6-symbol'

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android:
    'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

export default class App extends Component {

  state = {
      message: null
  }

  componentDidMount() {
    const getToken = () => fetch("http://192.168.1.125:3000/get-virgil-jwt")
        .then(res => res.json())
        .then(data => data.token);

    console.log('keyEntryStorage', keyEntryStorage);
    EThree.initialize(getToken, { keyEntryStorage: keyEntryStorage })
        .then(client => sdk = client)
        .then(() => sdk.register())
        .then(() => sdk.encrypt('success!'))
        .then((encryptedMessage) => sdk.decrypt(encryptedMessage))
        .then((message) => this.setState({ message: message }))
        .then(() => sdk.cleanup())
        .catch((error) => {
          this.setState({ message: error.toString() })
        });
  }
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Welcome to React Native!</Text>
        <Text style={styles.instructions}>To get started, edit App.js</Text>
        <Text style={styles.instructions}>{instructions}</Text>
        {this.state.message && <Text style={styles.instructions}>{this.state.message}</Text>}
      </View>
    );
  }
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
});
