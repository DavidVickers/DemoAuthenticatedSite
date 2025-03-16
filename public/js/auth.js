// Import JWT signing library (add this script to index.html and callback.html)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>

let oktaAuth;

// Initialize Okta Auth after fetching configuration
async function initializeAuth() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        
        console.log('Config loaded:', {
            issuer: config.oktaIssuer,
            clientId: config.clientId
        });
        
        oktaAuth = new OktaAuth({
            issuer: config.oktaIssuer,
            clientId: config.clientId,
            redirectUri: window.location.origin + '/callback',
            scopes: ['openid', 'profile', 'email']
        });

        // Check URL parameters for login status
        const urlParams = new URLSearchParams(window.location.search);
        const loginSuccess = urlParams.get('login');
        const error = urlParams.get('error');

        if (loginSuccess === 'success') {
            updateUI(true);
            initializeChat();
        } else if (error) {
            console.error('Login error:', error);
            updateUI(false, null, decodeURIComponent(error));
        } else {
            checkAuth();
        }

    } catch (error) {
        console.error('Failed to initialize auth:', error);
        updateUI(false, null, error.message);
    }
}

// Initialize auth when the page loads
initializeAuth();

// Login function
async function login() {
    try {
        if (!oktaAuth) {
            throw new Error('Authentication not initialized');
        }

        console.log('Starting login process...');
        updateUI(false, null, 'Initiating login...');

        // Create state
        const state = generateSessionId();

        // Get base domain from issuer URL
        const oktaDomain = oktaAuth.options.issuer.replace('/oauth2/default', '');
        
        // Construct the authorization URL with exact format
        const authUrl = new URL(`${oktaDomain}/oauth2/v1/authorize`);
        
        // Add required parameters
        const params = {
            client_id: '0oapqf53ryMdtfqoE697', // Hardcoding to ensure correct ID
            response_type: 'code',
            scope: 'openid profile email',
            redirect_uri: 'https://vickers-demo-site.herokuapp.com/callback', // Hardcoding full URL
            state: state
        };

        // Add all parameters to URL
        Object.entries(params).forEach(([key, value]) => {
            authUrl.searchParams.append(key, value);
        });

        const finalUrl = authUrl.toString();
        console.log('Redirecting to:', finalUrl);
        
        // Verify URL format before redirect
        if (!finalUrl.includes('trial-8906870.okta.com')) {
            throw new Error('Invalid Okta domain in authorization URL');
        }

        // Redirect to Okta
        window.location.assign(finalUrl);

    } catch (error) {
        console.error('Login error:', error);
        updateUI(false, null, `Login error: ${error.message}`);
    }
}

// Helper function to generate session ID
function generateSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Logout function
async function logout() {
    try {
        window.location.href = oktaAuth.options.issuer + '/v1/logout?' +
            new URLSearchParams({
                client_id: oktaAuth.options.clientId,
                post_logout_redirect_uri: window.location.origin
            });
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Check authentication state
async function checkAuth() {
    try {
        console.log('Checking authentication state...');
        updateUI(false, null, 'Checking authentication...');
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

    if (isAuthenticated) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        username.textContent = user ? `Welcome, ${user.name}!` : 'Welcome!';
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