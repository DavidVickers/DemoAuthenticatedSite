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

// Initialize Redis and session before setting up routes
async function initializeServer() {
    // Initialize Redis client
    const redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            tls: true,
            rejectUnauthorized: false
        }
    });

    // Add Redis error handling
    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Successfully connected to Redis');
    });

    try {
        await redisClient.connect();
        
        // Configure session middleware
        app.use(session({
            store: new RedisStore({ client: redisClient }),
            secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
            resave: false,
            saveUninitialized: false,
            name: 'sessionId',
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                sameSite: 'lax'
            }
        }));

        // Add session debugging middleware
        app.use((req, res, next) => {
            console.log('Session Debug:', {
                sessionID: req.sessionID,
                hasSession: !!req.session,
                sessionData: req.session
            });
            next();
        });

        // Body parsers
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Callback route
        app.get('/callback', async (req, res) => {
            try {
                console.log('=== /callback route hit ===');
                console.log('Session state:', {
                    id: req.sessionID,
                    session: req.session
                });

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
                console.log('Setting session data:', {
                    isAuthenticated: true,
                    user: {
                        name: `${userInfo.given_name} ${userInfo.family_name}`,
                        email: userInfo.email
                    }
                });

                req.session.isAuthenticated = true;
                req.session.user = {
                    name: `${userInfo.given_name} ${userInfo.family_name}`,
                    email: userInfo.email
                };

                // Save session explicitly
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Session save error:', err);
                            reject(err);
                            return;
                        }
                        console.log('Session saved successfully');
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

        // Start the server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log('App Configuration:', {
                issuer: process.env.OKTA_ISSUER_URL,
                clientId: process.env.OKTA_CLIENT_ID,
                environment: process.env.NODE_ENV
            });
        });

    } catch (err) {
        console.error('Failed to initialize server:', err);
        process.exit(1);
    }
}

// Start the server
initializeServer().catch(err => {
    console.error('Server initialization failed:', err);
    process.exit(1);
});
