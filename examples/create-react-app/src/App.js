import React from "react";
import { EThree } from "@virgilsecurity/e3kit-browser";

import "./App.css";

const createGetToken = identity => async () => {
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}/virgil-jwt?identity=${identity}`
  );
  const { virgil_jwt: virgilJwt } = await response.json();
  return virgilJwt;
};

function App() {
  const [messages, setMessages] = React.useState([]);
  React.useEffect(() => {
    (async () => {
      try {
        const alice = await EThree.initialize(createGetToken(`alice-${Math.random()}`));
        const bob = await EThree.initialize(createGetToken(`bob-${Math.random()}`));

        setMessages(messages => messages.concat(["Alice registers..."]));
        await alice.register();

        setMessages(messages =>
          messages.concat(["Alice creates private key backup..."])
        );
        await alice.backupPrivateKey("alice_pa$$w0rd");

        setMessages(messages => messages.concat(["Bob registers..."]));
        await bob.register();

        setMessages(messages =>
          messages.concat(["Bob creates private key backup..."])
        );
        await bob.backupPrivateKey("bob_pa$$w0rd");

        setMessages(messages =>
          messages.concat(["Alice searches for Bob's card..."])
        );
        const bobCard = await alice.findUsers(bob.identity);

        setMessages(messages =>
          messages.concat(["Alice encrypts message for Bob..."])
        );
        const encryptedForBob = await alice.encrypt("Hello Bob!", bobCard);

        setMessages(messages =>
          messages.concat(["Bob searches for Alice's card..."])
        );
        const aliceCard = await bob.findUsers(alice.identity);

        setMessages(messages =>
          messages.concat(["Bob decrypts the message..."])
        );
        const decryptedByBob = await bob.decrypt(encryptedForBob, aliceCard);

        setMessages(messages =>
          messages.concat(["Decrypted message: " + decryptedByBob])
        );

        const groupId = "AliceAndBobGroup";

        setMessages(messages =>
          messages.concat(["Alice creates a group with Bob..."])
        );
        const aliceGroup = await alice.createGroup(groupId, bobCard);

        setMessages(messages =>
          messages.concat(["Alice encrypts message for the group..."])
        );
        const encryptedForGroup = await aliceGroup.encrypt("Hello group!");

        setMessages(messages =>
          messages.concat(["Bob loads the group by ID from the Cloud..."])
        );
        const bobGroup = await bob.loadGroup(groupId, aliceCard);

        setMessages(messages =>
          messages.concat(["Bob decrypts the group message..."])
        );
        const decryptedByGroup = await bobGroup.decrypt(
          encryptedForGroup,
          aliceCard
        );

        setMessages(messages =>
          messages.concat(["Decrypted group message: " + decryptedByGroup])
        );

        setMessages(messages =>
            messages.concat(["Encrypting shared file ..."])
        );
        const { encryptedSharedFile, fileKey } = await alice.encryptSharedFile(
            new File(['some file'], 'some_file.txt')
        );

        setMessages(messages =>
            messages.concat(["Encrypting file key for group ..."])
        );

        const encryptedFileKeyForGroup = await aliceGroup.encrypt(fileKey);

        const decryptedFileKey = await bobGroup.decrypt(encryptedFileKeyForGroup, aliceCard);

        setMessages(messages =>
            messages.concat(["Decrypted file key from group is: " + decryptedFileKey.toString('base64')])
        );

        const decryptedSharedFile = await bob.decryptSharedFile(
            encryptedSharedFile,
            decryptedFileKey,
            aliceCard
        );

        setMessages(messages =>
            messages.concat(["Downloading encrypted file"])
        );

        download(decryptedSharedFile)

        setMessages(messages => messages.concat(["Alice deletes group..."]));
        await alice.deleteGroup(groupId);

        setMessages(messages =>
          messages.concat(["Alice deletes private key backup..."])
        );
        await alice.resetPrivateKeyBackup("alice_pa$$w0rd");

        setMessages(messages => messages.concat(["Alice unregisters..."]));
        await alice.unregister();

        setMessages(messages =>
          messages.concat(["Bob deletes private key backup..."])
        );
        await bob.resetPrivateKeyBackup("bob_pa$$w0rd");
        setMessages(messages => messages.concat(["Bob unregisters..."]));
        await bob.unregister();
      } catch (error) {
        setMessages(messages => messages.concat([error.toString()]));
      }
    })();
  }, []);
  return messages.map(message => <p key={message}>{message}</p>);
}

function download(file) {
    var element = document.createElement('a');
    element.setAttribute('href', URL.createObjectURL(file));
    element.setAttribute('download', file.name);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

export default App;
