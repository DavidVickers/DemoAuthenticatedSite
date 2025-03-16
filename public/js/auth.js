// Import JWT signing library (add this script to index.html and callback.html)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>

let oktaAuth;
let privateKey;
let issuerUrl; // Add this to store the issuer URL

// Function to create a signed JWT assertion
function createSignedJWT(clientId) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: clientId,
        sub: clientId,
        // Use stored issuerUrl instead of oktaAuth.options
        aud: issuerUrl + '/v1/token',
        iat: now,
        exp: now + 300, // 5 minutes expiry
        jti: crypto.randomUUID()
    };

    const jwt = KJUR.jws.JWS.sign(
        'RS256',
        JSON.stringify(header),
        JSON.stringify(payload),
        privateKey
    );

    return jwt;
}

// Initialize Okta Auth after fetching configuration
async function initializeAuth() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        
        console.log('Config loaded:', {
            issuer: config.oktaIssuer,
            clientId: config.oktaClientId,
            hasPrivateKey: !!config.privateKey
        });
        
        // Store issuer URL
        issuerUrl = config.oktaIssuer;
        
        // Format the private key by ensuring proper line breaks
        privateKey = config.privateKey
            .replace(/\\n/g, '\n')
            .replace(/"/g, '')
            .trim();
            
        console.log('Private key formatted:', privateKey.slice(0, 50) + '...');
        
        // Create JWT before initializing oktaAuth
        const initialJwt = createSignedJWT(config.oktaClientId);
        
        oktaAuth = new OktaAuth({
            issuer: config.oktaIssuer,
            clientId: config.oktaClientId,
            redirectUri: window.location.origin + '/callback',
            scopes: ['openid', 'profile', 'email'],
            tokenManager: {
                storage: 'localStorage'
            },
            pkce: false,
            responseType: ['code'],
            clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            clientAssertion: initialJwt
        });

        // Wait for oktaAuth to be properly initialized
        await oktaAuth.start();

        // Add status indicator to the page
        const header = document.querySelector('header');
        const statusDiv = document.createElement('div');
        statusDiv.id = 'auth-status';
        statusDiv.style.padding = '10px';
        header.appendChild(statusDiv);

        // Check auth state after initialization
        if (window.location.pathname !== '/callback') {
            await checkAuth();
        }
    } catch (error) {
        console.error('Failed to initialize auth:', error);
        updateUI(false, null, error.message);
    }
}

// Initialize auth when the page loads
initializeAuth();

// Login function with better error handling
async function login() {
    try {
        if (!oktaAuth) {
            throw new Error('Authentication not initialized');
        }

        console.log('Starting login process...');
        updateUI(false, null, 'Initiating login...');

        // Create the signed JWT
        const clientAssertion = createSignedJWT(oktaAuth.options.clientId);
        
        console.log('Created client assertion JWT');

        // Start the authorization flow using the correct method
        await oktaAuth.signInWithRedirect({
            responseType: ['code'],
            responseMode: 'query',
            clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            clientAssertion: clientAssertion
        });

    } catch (error) {
        console.error('Login error:', error);
        updateUI(false, null, `Login error: ${error.message}`);
    }
}

// Handle callback
async function handleCallback() {
    try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (code) {
            // Exchange the authorization code for tokens
            const tokenParams = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: oktaAuth.options.redirectUri,
                client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                client_assertion: createSignedJWT(oktaAuth.options.clientId)
            });

            const response = await fetch(oktaAuth.options.issuer + '/v1/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: tokenParams
            });

            const tokens = await response.json();
            
            if (tokens.error) {
                throw new Error(tokens.error_description || tokens.error);
            }

            // Store the tokens
            await oktaAuth.tokenManager.setTokens(tokens);
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Callback error:', error);
    }
}

// Logout function
async function logout() {
    try {
        await oktaAuth.signOut();
        updateUI(false);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Check authentication state with better error handling
async function checkAuth() {
    try {
        console.log('Checking authentication state...');
        const authenticated = await oktaAuth.isAuthenticated();
        console.log('Is authenticated:', authenticated);
        
        if (authenticated) {
            const user = await oktaAuth.getUser();
            console.log('User info:', user);
            updateUI(true, user);
            initializeChat();
        } else {
            updateUI(false);
        }
    } catch (error) {
        console.error('Auth check error:', error);
        updateUI(false, null, `Auth check error: ${error.message}`);
    }
}

// Update UI with more detailed status
function updateUI(isAuthenticated, user = null, message = '') {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const username = document.getElementById('username');
    const statusDiv = document.getElementById('auth-status');

    if (isAuthenticated && user) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        username.textContent = `Welcome, ${user.name}!`;
        if (statusDiv) {
            statusDiv.textContent = 'Authenticated';
            statusDiv.style.backgroundColor = '#dff0d8';
            statusDiv.style.color = '#3c763d';
        }
    } else {
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        username.textContent = '';
        if (statusDiv) {
            statusDiv.textContent = message || 'Not authenticated';
            statusDiv.style.backgroundColor = '#f2dede';
            statusDiv.style.color = '#a94442';
        }
    }
}

// Check auth state when page loads
if (window.location.pathname !== '/callback') {
    checkAuth();
} 