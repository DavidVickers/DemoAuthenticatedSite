const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const app = express();
require('dotenv').config();

// Initialize Redis and server asynchronously
async function initializeServer() {
    try {
        // Initialize Redis client
        const redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                tls: process.env.NODE_ENV === 'production',
                rejectUnauthorized: false
            }
        });

        // Connect to Redis
        await redisClient.connect();
        console.log('Successfully connected to Redis');

        // Set up session middleware with Redis
        app.use(session({
            store: new RedisStore({ client: redisClient }),
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

        // Routes
        app.post('/auth/pkce', async (req, res) => {
            const { code_verifier, state } = req.body;
            if (!code_verifier || !state) {
                return res.status(400).json({ error: 'Missing PKCE parameters' });
            }

            req.session.codeVerifier = code_verifier;
            req.session.state = state;
            
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({ success: true });
        });

        // Update callback route to use PKCE
        app.get('/callback', async (req, res) => {
            try {
                console.log('=== /callback route hit ===');
                console.log('Session data:', req.session);
                
                const code = req.query.code;
                const state = req.query.state;

                if (!code) {
                    throw new Error('No authorization code returned');
                }

                if (!req.session.codeVerifier) {
                    throw new Error('PKCE code verifier not found in session');
                }

                const now = Math.floor(Date.now() / 1000);
                const jwtPayload = {
                    iss: process.env.OKTA_CLIENT_ID,
                    sub: process.env.OKTA_CLIENT_ID,
                    aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
                    iat: now,
                    exp: now + 300,
                    jti: crypto.randomUUID()
                };

                const clientAssertion = jwt.sign(jwtPayload, process.env.PRIVATE_KEY, {
                    algorithm: 'RS256',
                    header: { alg: 'RS256', typ: 'JWT' }
                });

                // Token exchange with PKCE
                const bodyParams = new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback',
                    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                    client_assertion: clientAssertion,
                    code_verifier: req.session.codeVerifier
                });

                const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
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
                
                req.session.isAuthenticated = true;
                req.session.user = {
                    name: `${userInfo.given_name} ${userInfo.family_name}`,
                    email: userInfo.email
                };

                // Clear PKCE verifier after successful authentication
                delete req.session.codeVerifier;
                
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) reject(err);
                        else resolve();
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

        // Start server
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log('App Configuration:', {
                issuer: process.env.OKTA_ISSUER_URL,
                clientId: process.env.OKTA_CLIENT_ID,
                environment: process.env.NODE_ENV
            });
        });

    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

// Start the server
initializeServer().catch(err => {
    console.error('Server initialization failed:', err);
    process.exit(1);
});
