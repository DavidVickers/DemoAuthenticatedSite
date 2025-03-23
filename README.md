# Salesforce Embedded Chat with Okta Authentication

A demo application showcasing integration between Salesforce Embedded Messaging and Okta authentication. This application provides a secure chat interface where users must authenticate through Okta before accessing the messaging features.

## Features

- Okta Authentication Integration
- Salesforce Embedded Messaging
- User Session Management
- Secure Chat Access
- Responsive Design

## Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) installed (v14 or higher)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- A [Salesforce org](https://developer.salesforce.com/signup) with Embedded Service Chat configured
- An [Okta Developer Account](https://developer.okta.com/signup/)
- [Git](https://git-scm.com/downloads) installed

## Configuration

### Okta Setup

1. Create a new application in Okta:
   - Sign in to your Okta Developer Console
   - Go to Applications > Create App Integration
   - Select OIDC - OpenID Connect
   - Choose Web Application
   - Configure the following settings:
     - Login redirect URIs: `https://your-app-name.herokuapp.com/auth/callback`
     - Logout redirect URIs: `https://your-app-name.herokuapp.com`
   - In the Application settings, select "Public key / Private key" as the authentication method
   - Upload your public key or use Okta's UI to generate a key pair

2. Note down the following:
   - Client ID
   - Your private key (save it securely)
   - Okta Domain/Issuer URL

### Salesforce Setup

1. Configure Embedded Service Chat in your Salesforce org
2. Note down the following details:
   - Organization ID
   - Deployment ID
   - Base URL
   - SCRT2 URL

## Deployment

### Initial Setup

1. Clone this repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Create a new Heroku app:
```bash
heroku create your-app-name
```

3. Set up environment variables in Heroku:
```bash
heroku config:set OKTA_CLIENT_ID=your_client_id
heroku config:set OKTA_ISSUER=https://your-okta-domain/oauth2/default
heroku config:set OKTA_REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
heroku config:set PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----"
```

### Deployment Steps

1. Push to Heroku:
```bash
git push heroku main
```

2. Ensure the app is running:
```bash
heroku ps:scale web=1
```

3. Open the application:
```bash
heroku open
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your configuration:
```env
OKTA_CLIENT_ID=your_client_id
OKTA_ISSUER=https://your-okta-domain/oauth2/default
OKTA_REDIRECT_URI=http://localhost:3000/auth/callback
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----"
```

3. Start the development server:
```bash
npm start
```

## Project Structure 

## Security Features

- Public/Private Key Authentication
- JWT Token Signing
- Secure Session Management
- HTTPS Enforcement
- User Verification for Chat 