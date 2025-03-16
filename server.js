const express = require('express');
const path = require('path');
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

// Handle the token exchange
app.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        
        console.log('Received authorization code');
        
        // Exchange the code for tokens
        const tokenEndpoint = `${process.env.OKTA_ISSUER_URL}/v1/token`;
        const clientAssertion = createJWT(
            process.env.OKTA_CLIENT_ID,
            process.env.PRIVATE_KEY,
            process.env.OKTA_ISSUER_URL
        );

        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${req.protocol}://${req.get('host')}/callback`,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: clientAssertion
        });

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenParams
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            throw new Error(tokens.error_description || tokens.error);
        }

        // Get user info
        const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userInfo = await userInfoResponse.json();

        // Store tokens and user info in session or send to client
        res.json({
            success: true,
            message: 'Authentication successful',
            user_info: userInfo
        });

    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to create JWT
function createJWT(clientId, privateKey, issuer) {
    const now = Math.floor(Date.now() / 1000);
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    
    const payload = {
        iss: clientId,
        sub: clientId,
        aud: `${issuer}/v1/token`,
        iat: now,
        exp: now + 300,
        jti: crypto.randomUUID()
    };

    return jwt.sign(payload, privateKey, { 
        algorithm: 'RS256',
        header: header 
    });
}

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 