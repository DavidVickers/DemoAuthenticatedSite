const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static('public'));

// Serve configuration
app.get('/config', (req, res) => {
    // Format private key to ensure proper line breaks
    const formattedPrivateKey = process.env.PRIVATE_KEY
        .replace(/\\n/g, '\n')
        .replace(/"/g, '')
        .trim();

    res.json({
        oktaIssuer: process.env.OKTA_ISSUER_URL,
        oktaClientId: process.env.OKTA_CLIENT_ID,
        privateKey: formattedPrivateKey
    });
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve callback.html for the callback route
app.get('/callback', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'callback.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 