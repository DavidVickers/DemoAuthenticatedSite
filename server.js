const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const session = require('express-session');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Configure session middleware FIRST
app.use(session({
    secret: crypto.randomBytes(32).toString('hex'), // Generate a random secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Required for production HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add body parser for JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add authentication check middleware
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isAuthenticated;
    res.locals.user = req.session.user;
    next();
});

// IMPORTANT: Place callback route BEFORE static file serving
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.redirect('/?error=' + encodeURIComponent('No authorization code returned'));
    }

    try {
        console.log('Received authorization code, starting token exchange');

        // Create JWT for token exchange
        const clientAssertion = jwt.sign({
            iss: process.env.OKTA_CLIENT_ID,
            sub: process.env.OKTA_CLIENT_ID,
            aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300,
            jti: crypto.randomUUID()
        }, process.env.PRIVATE_KEY, {
            algorithm: 'RS256',
            header: { alg: 'RS256', typ: 'JWT' }
        });

        // Exchange code for tokens
        const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
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
        console.log('Token exchange completed');

        if (!tokenResponse.ok) {
            throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
        }

        // Get user info using access token
        const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        const userInfo = await userInfoResponse.json();
        console.log('User info retrieved');

        // Store in session
        req.session.isAuthenticated = true;
        req.session.tokens = tokens;
        req.session.user = userInfo;
        
        // Ensure session is saved before redirect
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/?error=' + encodeURIComponent('Session save failed'));
            }
            console.log('Session saved, redirecting to home');
            res.redirect('/');
        });

    } catch (error) {
        console.error('Token exchange failed:', error);
        res.redirect('/?error=' + encodeURIComponent(error.message));
    }
});

// API routes
app.get('/config', (req, res) => {
    res.json({
        oktaIssuer: process.env.OKTA_ISSUER_URL,
        clientId: process.env.OKTA_CLIENT_ID,
        isAuthenticated: req.session.isAuthenticated || false
    });
});

app.get('/auth/status', (req, res) => {
    res.json({
        isAuthenticated: req.session.isAuthenticated || false,
        user: req.session.user || null
    });
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Serve static files AFTER routes
app.use(express.static('public'));

// Serve index.html last
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 