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
  const code = req.query.code;
  if (!code) {
    console.error('No authorization code returned');
    return res.redirect('/?error=' + encodeURIComponent('No authorization code returned'));
  }

  try {
    console.log('Received authorization code, starting token exchange');

    // Create a JWT for client authentication (client assertion)
    const clientAssertion = jwt.sign({
      iss: process.env.OKTA_CLIENT_ID,
      sub: process.env.OKTA_CLIENT_ID,
      aud: `${process.env.OKTA_ISSUER_URL}/v1/token`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // expires in 5 minutes
      jti: crypto.randomUUID()
    }, process.env.PRIVATE_KEY, {
      algorithm: 'RS256',
      header: { alg: 'RS256', typ: 'JWT' }
    });

    // Exchange code for tokens with Okta
    const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CALLBACK_URL,  // Use our updated callback URL
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      })
    });

    const tokens = await tokenResponse.json();
    console.log('Token exchange response:', tokens);

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokens);
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    }

    // Retrieve user info using the access token
    const userInfoResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    const userInfo = await userInfoResponse.json();
    console.log('User info retrieved:', userInfo);

    // Store tokens and user info in session
    req.session.isAuthenticated = true;
    req.session.tokens = tokens;
    req.session.user = userInfo;

    // Save session and redirect to home page
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
});
