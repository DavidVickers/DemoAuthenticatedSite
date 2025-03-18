// Note: The JWT signing library is included in index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>
//help
// Login function: builds the authorization URL and redirects the browser to Okta
async function login() {
    try {
        console.log('Login clicked');
        if (!window.authClient) {
            throw new Error('Auth client not initialized');
        }
        
        const state = generateSessionId();
        console.log('Generated state:', state);

        // Redirect to Okta without PKCE
        await window.authClient.token.getWithRedirect({
            responseType: 'code',
            state: state,
            scopes: ['openid', 'profile', 'email']
        });
    } catch (error) {
        console.error('Login error:', error);
        updateUI(false, null, 'Login failed: ' + error.message);
    }
}

// Helper function to generate a random state value
function generateSessionId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Logout function: sends the user to the logout endpoint on the server
async function logout() {
  try {
    window.location.href = '/auth/logout';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Optional: function to manually check authentication state (if needed)
async function checkAuth() {
  try {
    console.log('Checking authentication state...');
    updateUI(false, null, 'Checking authentication...');
  } catch (error) {
    console.error('Auth check error:', error);
    updateUI(false, null, `Auth check error: ${error.message}`);
  }
}

// Update the UI based on authentication status
function updateUI(isAuthenticated, user = null) {
    console.log('Updating UI:', { isAuthenticated, user });
    
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const userInfoDiv = document.getElementById('user-info-display');
    const statusDiv = document.getElementById('auth-status');

    if (isAuthenticated && user) {
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        
        userInfoDiv.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome, ${user.name}!</h2>
                <p>Email: ${user.email}</p>
            </div>
        `;
        userInfoDiv.style.display = 'block';
        
        if (statusDiv) {
            statusDiv.textContent = 'Authenticated';
            statusDiv.style.backgroundColor = '#dff0d8';
            statusDiv.style.color = '#3c763d';
        }
    } else {
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        userInfoDiv.style.display = 'none';
        userInfoDiv.innerHTML = '';
        
        if (statusDiv) {
            statusDiv.textContent = 'Not authenticated';
            statusDiv.style.backgroundColor = '#f2dede';
            statusDiv.style.color = '#a94442';
        }
    }
}

// Update checkAuthStatus to handle the UI updates
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/auth/status');
        const status = await response.json();
        console.log('Auth status response:', status);
        
        if (status.isAuthenticated && status.user) {
            console.log('User is authenticated:', status.user);
            updateUI(true, status.user);
            if (typeof initializeChat === 'function') {
                initializeChat();
            }
        } else {
            console.log('User is not authenticated');
            updateUI(false);
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        // Don't show error to user, just update UI as not authenticated
        updateUI(false);
    }
}

// Add PKCE helper functions
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return base64URLEncode(array);
}

function base64URLEncode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(digest);
}

// Update initialization
async function initializeAuth() {
    try {
        const response = await fetch('/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        console.log('Auth config loaded:', config);

        const authClient = new OktaAuth({
            issuer: config.oktaIssuer,
            clientId: config.clientId,
            redirectUri: config.redirectUri,
            responseType: 'code',
            pkce: true,
            scopes: ['openid', 'profile', 'email']
        });

        window.authClient = authClient;
        await checkAuthStatus();
    } catch (error) {
        console.error('Error initializing auth:', error);
        updateUI(false, null, 'Error initializing authentication');
    }
}

// Add event listeners for buttons
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, setting up event listeners');
    
    // Add login button click handler
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', login);
        console.log('Login button handler attached');
    }

    // Add logout button click handler
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
        console.log('Logout button handler attached');
    }

    // Initial auth check
    checkAuthStatus();
});

// Add event listener for successful auth
if (window.location.search.includes('auth=success')) {
    console.log('Auth success detected, checking status');
    checkAuthStatus();
}
