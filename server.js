const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const session = require('express-session');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Configure session middleware
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  // If testing locally over HTTP, set secure to false.
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS), false for local HTTP testing
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Body parsers for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach authentication status to res.locals for use in templates (if needed)
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.user = req.session.user;
  next();
});

// ------------------------
// Callback Route (Token Exchange)
// ------------------------
// This route must be placed BEFORE the static file serving middleware.
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

    // Perform the token exchange with Okta
    const tokenResponse = await fetch(`${process.env.OKTA_ISSUER_URL}/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://vickers-demo-site.herokuapp.com/callback', // Must match your Okta configuration
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

    // Store authentication status and tokens in session
    req.session.isAuthenticated = true;
    req.session.tokens = tokens;
    req.session.user = userInfo;

    // Save the session and redirect to the home page
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
// API Routes and Endpoints
// ------------------------

// Provide configuration data for the client (e.g., Okta issuer, client ID)
app.get('/config', (req, res) => {
  res.json({
    oktaIssuer: process.env.OKTA_ISSUER_URL,
    clientId: process.env.OKTA_CLIENT_ID,
    isAuthenticated: req.session.isAuthenticated || false
  });
});

// Return authentication status to client-side code
app.get('/auth/status', (req, res) => {
  res.json({
    isAuthenticated: req.session.isAuthenticated || false,
    user: req.session.user || null
  });
});

// Logout route – destroys session and redirects to home
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ------------------------
// Static File Serving
// ------------------------
// Make sure no static file (like a callback.html) conflicts with our /callback route.
app.use(express.static('public'));

// Catch-all for root: serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
