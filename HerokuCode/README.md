# Salesforce Embedded Chat with Okta Authentication.

A secure demo application that integrates Salesforce Embedded Messaging with Okta authentication, allowing only authenticated users to access your chat interface.

<h2 align="center">The Authetication flow to be achieved</h2>

![Authentication Flow](../ImageFiles/UserVerificationFlow.png)

# Features

* Okta Authentication with PKCE flow and JWT client assertions
* Salesforce Embedded Messaging with verified user sessions
* Redis-backed session management for reliability
* Secure token handling for identity verification
* Mobile-responsive design

# Implementation Details for Token-Based User Verification

<div align="center">
<h4>How This Project Handles JWT Token Passing to Salesforce</h4>
</div>
This project takes a streamlined approach to implementing Salesforce's token-based user verification using Okta as the identity provider. Below are key implementation details on how tokens are managed and passed between the components.
Utilizing Okta JWKS Endpoint
Our implementation leverages Okta's JWKS (JSON Web Key Set) endpoint for seamless key management:

https://your-org.okta.com/oauth2/default/v1/keys

This approach eliminates the need to manually manage and upload public keys to Salesforce, as Salesforce can directly fetch the necessary public keys from Okta's JWKS endpoint when verifying tokens.
Token Handling Flow

# Server-Side Token Storage:

Unlike many implementations that store tokens in browser storage (localStorage/sessionStorage)
Our approach stores the tokens securely in server-side Redis sessions
This provides better security as tokens are not exposed to client-side JavaScript

# Token Retrieval API:

The application implements a dedicated endpoint (/auth/chat-token)
This endpoint only returns tokens to authenticated users
The tokens are retrieved via an authenticated API call with proper session validation

# Event-Based Token Passing:

The implementation listens for Salesforce's onEmbeddedMessagingReady event
Upon receiving this event, it fetches the token from the server rather than storing it client-side
This "just-in-time" approach ensures tokens are always fresh when needed



# Logout Handling
Our implementation handles logout comprehensively:
javascriptCopy// When user logs out
async function onUserLogout() {
  try {
    await fetch('/auth/logout');  // ends user's session on your server
    await embeddedservice_bootstrap.userVerificationAPI.clearSession(true);
    console.log("User has logged out and chat session cleared.");
    // Now the user is fully logged out (both app session and chat session)
  } catch (error) {
    console.error("Error logging out or clearing embedded session:", error);
  }
}

# This approach ensures:

The user's session is terminated on the server
The Salesforce chat session is properly cleared
Both authentication states are synchronized

# Token Expiration Handling
The project implements proper token expiration handling using Salesforce's event system:
javascriptCopywindow.addEventListener("onEmbeddedMessagingIdentityTokenExpired", async () => {
  try {
    // 1. Attempt to fetch a fresh token from your server
    const response = await fetch('/auth/chat-token', { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to refresh chat token from server');
    }
    const data = await response.json();

    // 2. If still authenticated, set the new token
    if (data.token) {
      embeddedservice_bootstrap.userVerificationAPI.setIdentityToken({
        identityTokenType: "JWT",
        identityToken: data.token
      });
      console.log("Refreshed identity token was set in Salesforce.");
    } else {
      // If you can't get a valid token, clear the session
      console.warn("No token returned. Clearing session in embedded chat.");
      embeddedservice_bootstrap.userVerificationAPI.clearSession(true);
    }
  } catch (error) {
    console.error("Error refreshing the identity token:", error);
    // If you can't refresh, clear the session
    embeddedservice_bootstrap.userVerificationAPI.clearSession(true);
  }
});

# This implementation automatically:

Attempts to refresh tokens when Salesforce signals expiration
Cleanly handles failures by clearing the session
Provides appropriate logging for debugging purposes## Salesforce Setup

<div align="center">
<h3>Setting Up User Verification in Salesforce Embedded Messaging</h3>
</div>


# Prerequisites
Before you begin, ensure you have:

* Node.js installed (v18.x recommended)
* Heroku CLI installed
* A Salesforce org with Embedded Service Chat configured
* An Okta Developer Account (free tier available at developer.okta.com)
* Git installed on your computer
* Successfully created a basic Embedded Service Messaging deployment in Salesforce
* Tested the messaging on your website without authentication enabled
* Set up your Okta application with proper OIDC configuration
* Generated or uploaded your JWT signing keys in Okta

Step-by-Step Deployment Guide
1. Clone and Prepare Your Repository
bashCopy# Clone this repository to your local machine
git clone https://github.com/yourusername/sf-messaging-okta-demo.git

# Navigate into the project directory
cd sf-messaging-okta-demo

# Install dependencies
npm install
2. Okta Configuration

# Create a new Okta application:

Sign in to your Okta Developer Console
Navigate to Applications > Create App Integration
Select OIDC - OpenID Connect as the sign-in method
Choose Web Application as the application type
Click Next


# Configure the application settings:

App name: SF Chat Demo (or your preferred name)
Grant type: Authorization Code with PKCE
Sign-in redirect URIs: https://your-app-name.herokuapp.com/callback
Sign-out redirect URIs: https://your-app-name.herokuapp.com
Under CLIENT AUTHENTICATION, select Public key / Private key (JWT)
Either generate a new key pair using Okta's UI or upload your existing public key
Save the generated private key securely - you'll need it for your app
Click Save


# Configure Authorization Server:

Navigate to Security > API > Authorization Servers
You'll typically use the "default" server with an issuer URI like https://your-org.okta.com/oauth2/default
Click on the authorization server to configure it
Go to the Access Policies tab
Click Add New Access Policy
Create a policy for your application with:

Name: "My app" (or your preferred name)
Description: Your application description
Assign to: "All clients" or specifically to your client


In the policy, add a rule with these settings:

Grant type: Check "Client Credentials" and "Authorization Code"
User is: "Any user assigned the app"
Scopes requested: "Any scopes"
Token lifetime: Set access token to 5 hours and refresh token to 90 days
Click Save




Note your Okta application details:

Client ID
Okta Domain/Issuer URL (from the Authorization Servers page, e.g., https://your-org.okta.com/oauth2/default)
Your private key


Important: Verify the correct JWKS endpoint

Okta provides multiple key endpoints, and using the wrong one will cause authentication failures
The correct keys endpoint follows this pattern: https://your-okta-domain/oauth2/default/v1/keys
Example: https://trial-8906870.okta.com/oauth2/default/v1/keys (correct)
NOT: https://trial-8906870.okta.com/oauth2/v1/keys (incorrect - missing "/default")
When configuring Salesforce or any JWT verification, ensure you use the complete endpoint path including the "/default" segment



3. Salesforce Configuration

Set up Embedded Service Chat in your Salesforce org:

From Setup, search for Embedded Service > Chat Settings
Create a new deployment
Follow the Salesforce wizard to configure your chat deployment
Under Advanced Configuration, enable Use JWT for Authentication


Note the following details:

Organization ID (shown in the deployed code snippet)
Deployment ID (shown in the deployed code snippet)
Base URL and SCRT2 URL (shown in the deployed code snippet)


Update the chat initialization code in public/chat.js with your Salesforce details

4. Create a Heroku Application
bashCopy# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name

# Add the Heroku Redis add-on (for session storage)
heroku addons:create heroku-redis:hobby-dev
5. Configure Environment Variables
Set up the required environment variables in Heroku:
bashCopy# Set Okta variables
heroku config:set OKTA_CLIENT_ID=your_client_id
heroku config:set OKTA_ISSUER_URL=https://your-okta-domain/oauth2/default
heroku config:set CALLBACK_URL=https://your-app-name.herokuapp.com/callback

# Set a secure session secret
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)

# Set your private key (note the quotes around the multi-line value)
heroku config:set PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----"

# Set the environment to production
heroku config:set NODE_ENV=production
6. Deploy to Heroku
bashCopy# Commit your changes if you've made any
git add .
git commit -m "Ready for deployment"

# Deploy to Heroku
git push heroku main

# Ensure at least one dyno is running
heroku ps:scale web=1

# Open your application
heroku open
7. Verify Deployment

Visit your Heroku app URL: https://your-app-name.herokuapp.com
Click the "Login" button to test Okta authentication
After successful login, verify that the Salesforce chat widget appears and functions correctly

Local Development Setup
For local testing before deploying to Heroku:

Create a .env file in your project root with the following content:

CopyOKTA_CLIENT_ID=your_client_id
OKTA_ISSUER_URL=https://your-okta-domain/oauth2/default
CALLBACK_URL=http://localhost:3000/callback
SESSION_SECRET=your_random_secret
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----"
NODE_ENV=development

Start a local Redis server:

Install Redis locally or use a cloud-based Redis instance
Set the REDIS_URL in your .env file if not using a local default connection


Run the development server:

bashCopynpm start

Visit http://localhost:3000 in your browser

Troubleshooting Guide
Common Issues and Solutions

Authentication failures:

Verify your Okta Client ID and Issuer URL are correct
Ensure your private key matches the public key registered in Okta
Check server logs with heroku logs --tail for detailed error messages


Chat widget not loading:

Confirm your Salesforce deployment settings are correct
Verify that JWT authentication is properly configured in Salesforce
Check browser console for JavaScript errors


Session issues:

Ensure Redis connection is working properly
Check for session middleware configuration issues
Verify cookie settings match your domain


Deployment problems:

Make sure all required environment variables are set
Check application logs with heroku logs --tail
Verify that package.json includes all dependencies and specifies the correct Node.js version



Getting Support
For more assistance:

Okta Developer Support: developer.okta.com/support
Salesforce Developer Forums: developer.salesforce.com/forums
Heroku Dev Center: devcenter.heroku.com

Understanding the Code
Authentication Flow

User clicks the login button in the frontend
The application generates PKCE code challenge and redirects to Okta
User authenticates with Okta
Okta redirects back to the application with an authorization code
The server exchanges the code for tokens using JWT client assertion
User information is stored in the session
The JWT token is passed to Salesforce chat to verify the user identity

Key Files

server.js: Express server with authentication routes
public/auth.js: Frontend authentication logic
public/chat.js: Salesforce chat integration
public/index.html: Main application UI

Security Features

PKCE Flow: Prevents authorization code interception attacks
JWT Client Assertion: Secures the token exchange process with Okta
HttpOnly Cookies: Prevents client-side JavaScript from accessing cookies
Secure Redis Sessions: Keeps session data secure and scalable
HTTPS Enforcement: All cookies and communication use secure connections in production
Token Expiration Handling: Properly handles token refreshes and expirations

Understanding JWT and Key Verification
JWT Client Assertion
The application uses JWT client assertion for secure communication with Okta, which requires understanding of public/private key cryptography:

Key Pair Usage:

Private Key: Kept secret and used by your application to sign the JWT assertions
Public Key: Registered with Okta and used by Okta to verify the signatures


JWT Client Assertion Flow:

Your app creates a JWT with specific claims (issuer, subject, audience, expiration)
The JWT is signed using your private key with RS256 algorithm
Okta receives the JWT and verifies the signature using your registered public key
If verification succeeds, Okta knows the request genuinely came from your application


Key ID (kid) Importance:

Every JWT includes a "kid" (Key ID) in its header
This tells the recipient which public key to use for verification
Okta's JWKS (JSON Web Key Set) endpoint contains multiple keys, each with a unique "kid"
When Salesforce verifies the user's ID token, it:

Extracts the "kid" from the token header
Fetches Okta's JWKS endpoint to find the matching public key
Uses that specific key to verify the token signature




JWKS Endpoint Critical Details:

The correct endpoint must include the authorization server ID (e.g., "/default")
Example: https://your-org.okta.com/oauth2/default/v1/keys
Using the wrong endpoint means the correct public key won't be found
This results in verification failures even when everything else is correct


Troubleshooting Signature Verification:

If authentication fails, check the "kid" in your token
Verify it matches a "kid" in the JWKS endpoint
Confirm you're using the complete and correct JWKS endpoint URL
Inspect the JWT signature algorithm to ensure it matches the key type
