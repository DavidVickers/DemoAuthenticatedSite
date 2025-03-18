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

// Create Express app but don't start listening yet
const createApp = async () => {
    // Initialize Redis client first
    const redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            tls: process.env.NODE_ENV === 'production',
            rejectUnauthorized: false
        }
    });

    // Set up Redis error handling
    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    // Wait for Redis to connect
    await redisClient.connect();
    console.log('Successfully connected to Redis');

    // Now set up session middleware
    const sessionMiddleware = session({
        store: new RedisStore({ 
            client: redisClient,
            prefix: 'sess:',
        }),
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
        name: 'sessionId',
        resave: true,
        saveUninitialized: true,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        }
    });

    // Apply middleware in correct order
    app.use(sessionMiddleware);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Session debug middleware
    app.use((req, res, next) => {
        console.log('Session Debug:', {
            sessionID: req.sessionID,
            hasSession: !!req.session,
            codeVerifier: req.session?.codeVerifier ? 'present' : 'missing'
        });
        next();
    });

    // Routes
    app.post('/auth/pkce', async (req, res) => {
        try {
            const { code_verifier, state } = req.body;
            if (!code_verifier || !state) {
                return res.status(400).json({ error: 'Missing PKCE parameters' });
            }

            // Set session data
            req.session.codeVerifier = code_verifier;
            req.session.state = state;
            
            // Force session save and wait for completion
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        console.error('Failed to save session:', err);
                        reject(err);
                    } else {
                        console.log('Session saved successfully:', {
                            sessionId: req.sessionID,
                            hasCodeVerifier: !!req.session.codeVerifier
                        });
                        resolve();
                    }
                });
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error saving PKCE data:', error);
            res.status(500).json({ error: 'Failed to save PKCE data' });
        }
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

    return app;
};

// Start server only after everything is initialized
const startServer = async () => {
    try {
        const app = await createApp();
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
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start everything
startServer();
