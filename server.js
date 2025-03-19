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
        },
        legacyMode: false
    });

    // Set up Redis error handling
    redisClient.on('error', err => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Successfully connected to Redis');
    });

    // Now set up session middleware
    const sessionMiddleware = session({
        store: new RedisStore({ 
            client: redisClient,
            prefix: 'sess:',
            disableTouch: false,
            ttl: 86400, // 24 hours
            retry_strategy: function (options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('The server refused the connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        }),
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
        name: 'sessionId',
        resave: true,
        saveUninitialized: true,
        rolling: true,
        proxy: true, // Trust the reverse proxy
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax',
            path: '/'
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

    // API Routes first
    app.get('/auth/status', (req, res) => {
        console.log('Auth status check:', {
            sessionID: req.sessionID,
            isAuthenticated: !!req.session?.isAuthenticated,
            user: req.session?.user
        });
        
        res.json({
            isAuthenticated: !!req.session?.isAuthenticated,
            user: req.session?.user || null
        });
    });

    app.get('/config', (req, res) => {
        console.log('Config endpoint hit');
        res.json({
            oktaIssuer: process.env.OKTA_ISSUER_URL,
            clientId: process.env.OKTA_CLIENT_ID,
            redirectUri: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback',
            isAuthenticated: !!req.session?.isAuthenticated
        });
    });

    // Auth routes
    app.post('/auth/pkce', async (req, res) => {
        try {
            const { code_verifier, state } = req.body;
            if (!code_verifier || !state) {
                return res.status(400).json({ error: 'Missing PKCE parameters' });
            }

            req.session.codeVerifier = code_verifier;
            req.session.state = state;
            
            await new Promise((resolve, reject) => {
                req.session.save((err) => {
                    if (err) {
                        console.error('Failed to save session:', err);
                        reject(err);
                    } else {
                        console.log('Session saved:', {
                            sessionId: req.sessionID,
                            hasCodeVerifier: true
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

    app.get('/callback', async (req, res) => {
        try {
            console.log('=== /callback route hit ===');
            
            const code = req.query.code;
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

            // Keep the redirect to /?auth=success
            res.redirect('/?auth=success');
        } catch (error) {
            console.error('Callback error:', error);
            res.redirect('/?error=' + encodeURIComponent(error.message));
        }
    });

    app.get('/auth/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });

    // Add specific route for auth success
    app.get('/auth/success', (req, res) => {
        res.json({
            isAuthenticated: !!req.session?.isAuthenticated,
            user: req.session?.user || null
        });
    });

    // Static file serving AFTER API routes
    app.use(express.static('public'));

    // Root and catch-all routes LAST
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Optional catch-all route
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Connect to Redis
    (async () => {
        try {
            await redisClient.connect();
        } catch (err) {
            console.error('Failed to connect to Redis:', err);
        }
    })();

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
