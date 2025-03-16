// Import JWT signing library (add this script to index.html and callback.html)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>

let oktaAuth;

// Initialize Okta Auth after fetching configuration
async function initializeAuth() {
    try {
        const response = await fetch('/auth/status');
        const authStatus = await response.json();
        
        if (authStatus.isAuthenticated) {
            console.log('User is authenticated:', authStatus.user);
            updateUI(true, authStatus.user);
            initializeChat();
        } else {
            updateUI(false);
        }

    } catch (error) {
        console.error('Failed to check auth status:', error);
        updateUI(false, null, error.message);
    }
}

// Initialize auth when the page loads
initializeAuth();

// Login function
async function login() {
    try {
        console.log('Starting login process...');
        updateUI(false, null, 'Initiating login...');

        // Get the configuration from server
        const configResponse = await fetch('/config');
        const config = await configResponse.json();
        
        if (!config.oktaIssuer || !config.clientId) {
            throw new Error('Missing Okta configuration');
        }

        // Create state
        const state = generateSessionId();

        // Get base domain from issuer URL
        const oktaDomain = config.oktaIssuer.replace('/oauth2/default', '');
        
        // Construct the authorization URL
        const authUrl = new URL(`${oktaDomain}/oauth2/v1/authorize`);
        
        // Add required parameters
        const params = {
            client_id: config.clientId,
            response_type: 'code',
            scope: 'openid profile email',
            redirect_uri: 'https://vickers-demo-site.herokuapp.com/callback',
            state: state
        };

        // Add all parameters to URL
        Object.entries(params).forEach(([key, value]) => {
            authUrl.searchParams.append(key, value);
        });

        const finalUrl = authUrl.toString();
        console.log('Redirecting to:', finalUrl);

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
        window.location.href = '/auth/logout';
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