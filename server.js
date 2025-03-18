const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const session = require('express-session');
const app = express();
require('dotenv').config();
//help
const PORT = process.env.PORT || 3000;
// Use an environment variable for the callback URL, with a fallback.
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback';

// Remove all Redis-related code and use simple session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Callback route
app.get('/callback', async (req, res) => {
    try {
        console.log('=== /callback route hit ===');
        
        const code = req.query.code;
        if (!code) {
            throw new Error('No authorization code returned');
        }

        // Build JWT payload for client assertion
        const now = Math.floor(Date.now() / 1000);
        const jwtPayload = {
            iss: process.env.OKTA_CLIENT_ID,
            sub: process.env.OKTA_CLIENT_ID,
            aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
            iat: now,
            exp: now + 300,
            jti: crypto.randomUUID()
        };

        // Sign the JWT
        const clientAssertion = jwt.sign(jwtPayload, process.env.PRIVATE_KEY, {
            algorithm: 'RS256',
            header: { alg: 'RS256', typ: 'JWT' }
        });

        // Build token request WITHOUT any PKCE parameters
        const bodyParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback',
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: clientAssertion
        });

        // Token exchange
        const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: bodyParams
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            throw new Error(error.error_description || error.error || 'Token exchange failed');
        }

        const tokens = await tokenResponse.json();
        
        // Get user info
        const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        const userInfo = await userInfoResponse.json();
        
        // Set session data
        req.session.isAuthenticated = true;
        req.session.user = {
            name: `${userInfo.given_name} ${userInfo.family_name}`,
            email: userInfo.email
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    reject(err);
                }
                resolve();
            });
        });

        res.redirect('/?auth=success');
    } catch (error) {
        console.error('Callback error:', error);
        res.redirect('/?error=' + encodeURIComponent(error.message));
    }
});

// Auth status endpoint
app.get('/auth/status', (req, res) => {
    console.log('Auth status check:', {
        sessionID: req.sessionID,
        session: req.session
    });
    
    res.json({
        isAuthenticated: !!req.session?.isAuthenticated,
        user: req.session?.user || null
    });
});

// Config endpoint
app.get('/config', (req, res) => {
    console.log('Config endpoint hit');
    res.json({
        oktaIssuer: process.env.OKTA_ISSUER_URL,
        clientId: process.env.OKTA_CLIENT_ID,
        redirectUri: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback',
        isAuthenticated: !!req.session?.isAuthenticated
    });
});

// Static file serving
app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server directly
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('App Configuration:', {
        issuer: process.env.OKTA_ISSUER_URL,
        clientId: process.env.OKTA_CLIENT_ID,
        environment: process.env.NODE_ENV
    });
});
