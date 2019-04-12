import React, { Component } from 'react';
import { Text, View, Button } from 'react-native';
import 'whatwg-fetch';

export default class EThreeStatus extends Component {
    state = {
        hasLocalPrivateKey: '...Loading',
        publicKey: '...Loading',
        isRegistered: false,
    };

    checkStatus = async () => {
        const eThree = this.props.eThree;
        let hasLocalPrivateKey,
            publicKey,
            isRegistered = false;
        try {
            [hasLocalPrivateKey, publicKey] = await Promise.all([
                eThree.hasLocalPrivateKey(),
                eThree.lookupPublicKeys(eThree.identity).catch(e => {
                    if (e.name === 'LookupError') {
                        return e.lookupResult[eThree.identity];
                    }
                    throw e;
                }),
            ]);
        } catch (e) {
            console.error(e);
        }

        if (publicKey instanceof Error) {
            publicKey = publicKey.message;
        } else {
            publicKey = eThree.virgilCrypto.exportPublicKey(publicKey).toString('base64');
            isRegistered = true;
        }

        this.setState({
            hasLocalPrivateKey,
            publicKey,
            isRegistered,
        });
    };

    async componentDidMount() {
        await this.checkStatus();
    }

    register = () => this.props.eThree.register().then(this.checkStatue).catch(console.error);

    renderOnlyForRegistered() {
        if (!this.state.isRegistered) return null;
        return (
            <React.Fragment>
                <Button
                    title="Backup Private Key"
                    onPress={() =>
                        this.props.eThree
                            .backupPrivateKey('SECURE_PWD_FROM_USER')
                            .then(this.checkStatus)
                            .catch(console.error)
                    }
                />
                <Button
                    title="Cleanup"
                    onPress={() => this.props.eThree.cleanup().then(this.checkStatus)}
                />
                <Button
                    title="Restore Private Key"
                    onPress={() =>
                        this.props.eThree
                            .restorePrivateKey('SECURE_PWD_FROM_USER')
                            .then(this.checkStatus)
                            .catch(console.error)
                    }
                />
                <Button
                    title="Rotate Private Key"
                    onPress={() =>
                        this.props.eThree
                            .rotatePrivateKey()
                            .then(this.checkStatus)
                            .catch(console.error)
                    }
                />
                <Button
                    title="Reset Private Key backup"
                    onPress={() =>
                        this.props.eThree
                            .resetPrivateKeyBackup('SECURE_PWD_FROM_USER')
                            .then(this.checkStatus)
                            .catch(console.error)
                    }
                />
            </React.Fragment>
        );
    }

    render() {
        return (
            <View>
                <Text>Identity: {this.props.eThree.identity}</Text>
                <Text>
                    Local Private Key:{' '}
                    {this.state.hasLocalPrivateKey.toString
                        ? this.state.hasLocalPrivateKey.toString()
                        : this.state.hasLocalPrivateKey}
                </Text>
                <Text>Public Key: {this.state.publicKey}</Text>
                {this.state.isRegistered === false && (
                    <Button title="register" onPress={this.register}>
                        Register
                    </Button>
                )}
                {this.renderOnlyForRegistered()}
            </View>
        );
    }
}
