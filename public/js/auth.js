// Import JWT signing library (add this script to index.html and callback.html)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>

let oktaAuth;
let privateKey;

// Initialize Okta Auth after fetching configuration
async function initializeAuth() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        
        privateKey = config.privateKey;
        
        oktaAuth = new OktaAuth({
            issuer: config.oktaIssuer,
            clientId: config.oktaClientId,
            redirectUri: window.location.origin + '/callback',
            scopes: ['openid', 'profile', 'email'],
            tokenManager: {
                storage: 'localStorage'
            },
            authParams: {
                responseType: ['code'],
                pkce: false
            }
        });

        // Check auth state after initialization
        if (window.location.pathname !== '/callback') {
            checkAuth();
        }
    } catch (error) {
        console.error('Failed to initialize auth:', error);
    }
}

// Initialize auth when the page loads
initializeAuth();

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
        aud: oktaAuth.options.issuer + '/v1/token',
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

// Login function
async function login() {
    try {
        // Start the authorization flow
        const authParams = {
            responseType: ['code'],
            responseMode: 'query',
            clientAssertionType: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            clientAssertion: createSignedJWT(oktaAuth.options.clientId)
        };

        // Generate authorization URL and redirect
        const authUrl = await oktaAuth.token.prepareAuthorizeUrl(authParams);
        window.location.assign(authUrl);
    } catch (error) {
        console.error('Login error:', error);
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

// Check authentication state and update UI
async function checkAuth() {
    try {
        const authenticated = await oktaAuth.isAuthenticated();
        if (authenticated) {
            const user = await oktaAuth.getUser();
            updateUI(true, user);
            initializeChat();
        } else {
            updateUI(false);
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Update UI based on authentication state
function updateUI(isAuthenticated, user = null) {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const username = document.getElementById('username');

    if (isAuthenticated && user) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        username.textContent = `Welcome, ${user.name}!`;
    } else {
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        username.textContent = '';
    }
}

// Check auth state when page loads
if (window.location.pathname !== '/callback') {
    checkAuth();
} 