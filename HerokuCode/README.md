Salesforce Embedded Chat with Okta Authentication
A secure demo application that integrates Salesforce Embedded Messaging with Okta authentication, allowing only authenticated users to access your chat interface.
Show Image
Features

Okta Authentication with PKCE flow and JWT client assertions
Salesforce Embedded Messaging with verified user sessions
Redis-backed session management for reliability
Secure token handling for identity verification
Mobile-responsive design

Prerequisites
Before you begin, ensure you have:

Node.js installed (v18.x recommended)
Heroku CLI installed
A Salesforce org with Embedded Service Chat configured
An Okta Developer Account (free tier available at developer.okta.com)
Git installed on your computer

Step-by-Step Deployment Guide
1. Clone and Prepare Your Repository
bashCopy# Clone this repository to your local machine
git clone https://github.com/yourusername/sf-messaging-okta-demo.git

# Navigate into the project directory
cd sf-messaging-okta-demo

# Install dependencies
npm install
2. Okta Configuration

Create a new Okta application:

Sign in to your Okta Developer Console
Navigate to Applications > Create App Integration
Select OIDC - OpenID Connect as the sign-in method
Choose Web Application as the application type
Click Next


Configure the application settings:

App name: SF Chat Demo (or your preferred name)
Grant type: Authorization Code with PKCE
Sign-in redirect URIs: https://your-app-name.herokuapp.com/callback
Sign-out redirect URIs: https://your-app-name.herokuapp.com
Under CLIENT AUTHENTICATION, select Public key / Private key (JWT)
Either generate a new key pair using Okta's UI or upload your existing public key
Save the generated private key securely - you'll need it for your app
Click Save


Note your Okta application details:

Client ID
Okta Domain/Issuer URL (typically https://your-org.okta.com/oauth2/default)
Your private key



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


Set up user verification in SF
