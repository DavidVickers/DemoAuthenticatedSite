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

2. Note down the following credentials:
   - Client ID
   - Client Secret
   - Okta Domain

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
heroku config:set OKTA_CLIENT_SECRET=your_client_secret
heroku config:set OKTA_ISSUER=https://your-okta-domain/oauth2/default
heroku config:set OKTA_REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
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
OKTA_CLIENT_SECRET=your_client_secret
OKTA_ISSUER=https://your-okta-domain/oauth2/default
OKTA_REDIRECT_URI=http://localhost:3000/auth/callback
```

3. Start the development server:
```bash
npm start
```

## Project Structure 