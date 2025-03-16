const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const session = require('express-session');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;
// Use an environment variable for the callback URL, with a fallback.
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://vickers-demo-site-d3334f441edc.herokuapp.com/callback';

// Configure session middleware FIRST
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  // For production HTTPS, secure should be true. For local testing, set it to false.
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Body parsers for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach authentication status to res.locals (if needed)
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.user = req.session.user;
  next();
});

// ------------------------
// Callback Route (Token Exchange)
// ------------------------
// This must come BEFORE static middleware.
app.get('/callback', async (req, res) => {
  console.log('=== /callback route hit ===');
  console.log('Query parameters:', req.query);
  console.log('Headers:', req.headers);
  console.log('Session:', req.session);

  const code = req.query.code;
  if (!code) {
    console.error('No authorization code returned.');
    return res.redirect('/?error=' + encodeURIComponent('No authorization code returned'));
  }
  console.log('Authorization code received:', code);

  try {
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

    // Store tokens and user info in session
    req.session.isAuthenticated = true;
    req.session.tokens = tokens;
    req.session.user = userInfo;

    console.log('Saving session with tokens and user info...');
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/?error=' + encodeURIComponent('Session save failed'));
      }
      console.log('Session saved successfully, redirecting to home page.');
      res.redirect('/');
    });

  } catch (error) {
    console.error('Detailed error in /callback:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.redirect('/?error=' + encodeURIComponent(error.message));
  }
});

// ------------------------
// API Routes and other endpoints
// ------------------------
app.get('/config', (req, res) => {
  res.json({
    oktaIssuer: process.env.OKTA_ISSUER_URL,
    clientId: process.env.OKTA_CLIENT_ID,
    isAuthenticated: req.session.isAuthenticated || false,
    callbackUrl: CALLBACK_URL
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
