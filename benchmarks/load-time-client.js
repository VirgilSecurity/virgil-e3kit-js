const getToken = () => fetch('/get-jwt')
    .then(res => res.json())
    .then(data => data.token);

(async () => {
    const sdk = await E3kit.EThree.initialize(getToken);
    const heading = document.createElement('h1');
    const textNode = document.createTextNode('E3kit is ready!');
    heading.appendChild(textNode);
    document.body.appendChild(heading);
})();
