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

const PORT = process.env.PORT || 3000;
// Use an environment variable for the callback URL, with a fallback.
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback';

// Initialize Redis client with proper error handling
let redisClient;
let sessionMiddleware;

async function initializeRedis() {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                tls: true,
                rejectUnauthorized: false // Required for Heroku Redis
            }
        });

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        redisClient.on('connect', () => {
            console.log('Successfully connected to Redis');
        });

        await redisClient.connect();
        
        // Initialize session middleware
        sessionMiddleware = session({
            store: new RedisStore({ client: redisClient }),
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                sameSite: 'lax'
            }
        });

        // Apply middleware after Redis is connected
        app.use(sessionMiddleware);
        
        // Add cookie check middleware
        app.use((req, res, next) => {
            console.log('Cookie check:', {
                cookies: req.cookies,
                sessionID: req.sessionID,
                hasSession: !!req.session
            });
            next();
        });

        // Attach authentication status to res.locals
        app.use((req, res, next) => {
            res.locals.isAuthenticated = req.session?.isAuthenticated || false;
            res.locals.user = req.session?.user || null;
            next();
        });

        console.log('Redis and session middleware initialized successfully');
    } catch (err) {
        console.error('Failed to initialize Redis:', err);
        // Fallback to MemoryStore if Redis fails
        sessionMiddleware = session({
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                sameSite: 'lax'
            }
        });
        app.use(sessionMiddleware);
    }
}

// Initialize Redis and session middleware
initializeRedis().catch(console.error);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------
// Callback Route (Token Exchange)
// ------------------------
// This must come BEFORE static middleware.
app.get('/callback', async (req, res) => {
    const timeoutDuration = 25000; // 25 seconds (Heroku's timeout is 30s)
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timeout'));
        }, timeoutDuration);
    });

    try {
        // Race between the auth process and timeout
        await Promise.race([
            (async () => {
                console.log('=== /callback route hit ===');
                console.log('Query parameters:', req.query);
                console.log('Headers:', req.headers);
                console.log('Session:', req.session);

                const code = req.query.code;
                if (!code) {
                    console.error('No authorization code returned.');
                    throw new Error('No authorization code returned');
                }
                console.log('Authorization code received:', code);

                // Build JWT payload for client assertion
                const now = Math.floor(Date.now() / 1000);
                const jwtPayload = {
                    iss: process.env.OKTA_CLIENT_ID,
                    sub: process.env.OKTA_CLIENT_ID,
                    aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
                    iat: now,
                    exp: now + 300, // Token valid for 5 minutes
                    jti: crypto.randomUUID()
                };
                console.log('JWT payload:', jwtPayload);

                // Sign the JWT using your private key
                const clientAssertion = jwt.sign(jwtPayload, process.env.PRIVATE_KEY, {
                    algorithm: 'RS256',
                    header: { alg: 'RS256', typ: 'JWT' }
                });
                console.log('Generated client assertion JWT:', clientAssertion);

                // Build the token request body
                const bodyParams = new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback',
                    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                    client_assertion: clientAssertion
                });
                console.log('Token request body:', bodyParams.toString());

                // Define the token endpoint URL
                const tokenUrl = `${process.env.OKTA_ISSUER_URL}/v1/token`;
                console.log('Token endpoint URL:', tokenUrl);

                // Add more logging for the token exchange
                console.log('Token exchange request:', {
                    url: tokenUrl,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: bodyParams.toString()
                });

                // Make the token exchange request
                console.log('Making POST request to token endpoint...');
                const tokenResponse = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: bodyParams
                });
                console.log('Token response status:', tokenResponse.status);

                // Log full response details
                const tokens = await tokenResponse.json();
                console.log('Token response:', {
                    status: tokenResponse.status,
                    headers: Object.fromEntries(tokenResponse.headers),
                    body: tokens
                });

                if (!tokenResponse.ok) {
                    console.error('Token exchange error:', tokens);
                    throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
                }

                // Retrieve user info using the access token
                console.log('Attempting to fetch user info with access token...');
                const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                console.log('User info response status:', userInfoResponse.status);

                const userInfo = await userInfoResponse.json();
                console.log('User info retrieved:', userInfo);

                // After getting user info
                if (!req.session) {
                    throw new Error('Session not initialized');
                }

                req.session.isAuthenticated = true;
                req.session.user = {
                    name: `${userInfo.given_name} ${userInfo.family_name}`,
                    email: userInfo.email
                };

                // Save session with a promise wrapper
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Session save error:', err);
                            reject(err);
                            return;
                        }
                        resolve();
                    });
                });

                res.redirect('/?auth=success');
            })(),
            timeoutPromise
        ]);
    } catch (error) {
        console.error('Callback error:', error);
        if (error.message === 'Request timeout') {
            res.status(503).send('Authentication process timed out. Please try again.');
        } else {
            res.redirect('/?error=' + encodeURIComponent(error.message));
        }
    }
});

// ------------------------
// API Routes and other endpoints
// ------------------------
app.get('/config', (req, res) => {
    res.json({
        oktaIssuer: process.env.OKTA_ISSUER_URL,
        clientId: process.env.OKTA_CLIENT_ID,
        isAuthenticated: req.session?.isAuthenticated || false,
        callbackUrl: process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback'
    });
});

app.get('/auth/status', (req, res) => {
    console.log('Auth status check - Session data:', {
        id: req.sessionID,
        isAuthenticated: req.session?.isAuthenticated || false,
        user: req.session?.user || null
    });
    
    res.json({
        isAuthenticated: !!req.session?.isAuthenticated,
        user: req.session?.user || null
    });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ------------------------
// Static File Serving
// ------------------------
app.use(express.static('public'));

// Catch-all for root: serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('App Configuration:', {
    issuer: process.env.OKTA_ISSUER_URL,
    clientId: process.env.OKTA_CLIENT_ID,
    callbackUrl: CALLBACK_URL,
    environment: process.env.NODE_ENV
  });
});
