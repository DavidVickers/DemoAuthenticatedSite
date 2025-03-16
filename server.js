const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Add body parser for JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Serve configuration
app.get('/config', (req, res) => {
    res.json({
        oktaIssuer: process.env.OKTA_ISSUER_URL,
        clientId: process.env.OKTA_CLIENT_ID
    });
});

// Handle the token exchange at callback
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.redirect('/?error=' + encodeURIComponent('No authorization code returned'));
    }

    try {
        // Create a JWT for client authentication
        const clientAssertion = jwt.sign({
            iss: process.env.OKTA_CLIENT_ID,
            sub: process.env.OKTA_CLIENT_ID,
            aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300,
            jti: crypto.randomUUID()
        }, process.env.PRIVATE_KEY, {
            algorithm: 'RS256',
            header: {
                alg: 'RS256',
                typ: 'JWT'
            }
        });

        // Exchange code for tokens
        const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://vickers-demo-site.herokuapp.com/callback',
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: clientAssertion
            })
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
        }

        // Get user info
        const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userInfo = await userInfoResponse.json();

        // Store tokens in session or cookie (you might want to add session middleware)
        // For now, we'll just redirect with success
        res.redirect('/?login=success');

    } catch (error) {
        console.error('Token exchange failed:', error);
        res.redirect('/?error=' + encodeURIComponent(error.message));
    }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 