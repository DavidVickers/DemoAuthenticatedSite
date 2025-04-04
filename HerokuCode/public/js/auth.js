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
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        console.log('Generated PKCE values:', {
            state,
            hasCodeVerifier: !!codeVerifier,
            hasCodeChallenge: !!codeChallenge
        });

        // Store code verifier in session
        const response = await fetch('/auth/pkce', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code_verifier: codeVerifier,
                state: state
            }),
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to store PKCE parameters');
        }

        // Redirect with PKCE
        await window.authClient.token.getWithRedirect({
            responseType: 'code',
            state: state,
            scopes: ['openid', 'profile', 'email'],
            codeChallenge: codeChallenge,
            codeChallengeMethod: 'S256'
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
        // Clear chat session first and wait for it to complete
        if (window.embeddedservice_bootstrap?.userVerificationAPI) {
            await embeddedservice_bootstrap.userVerificationAPI
                .clearSession(true)
                .then(() => {
                    console.log('Chat session cleared successfully');
                    // Remove any remaining chat elements
                    const chatElements = document.querySelectorAll('[data-embeddedservice-chatbutton]');
                    chatElements.forEach(element => element.remove());
                })
                .catch((error) => {
                    console.error('Error clearing chat session:', error);
                })
                .finally(() => {
                    // Always proceed with logout even if chat cleanup fails
                    window.location.href = '/auth/logout';
                });
        } else {
            // If no chat API exists, proceed with normal logout
            window.location.href = '/auth/logout';
        }
    } catch (error) {
        console.error('Error during logout:', error);
        // Ensure logout happens even if entire process fails
        window.location.href = '/auth/logout';
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

// Update checkAuthStatus function to handle chat initialization more safely
async function checkAuthStatus() {
    try {
        console.log('Checking auth status...');
        const response = await fetch('/auth/status');
        const status = await response.json();
        console.log('Auth status response:', status);
        
        if (status.isAuthenticated && status.user) {
            console.log('User is authenticated:', status.user);
            updateUI(true, status.user);
            
            // Only try to initialize chat if the function exists and we're on the main page
            if (typeof initializeChat === 'function' && !window.location.search.includes('auth=success')) {
                try {
                    await initializeChat();
                } catch (chatError) {
                    console.warn('Chat initialization failed:', chatError);
                    // Continue with auth flow even if chat fails
                }
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

// Add back PKCE helper functions
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

// Update initialization to include PKCE
async function initializeAuth() {
    try {
        const response = await fetch('/config');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        console.log('Auth config loaded:', config);

        // Initialize with PKCE enabled
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

        // Add click handlers after initialization
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', login);
            console.log('Login button handler attached');
        }

        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
            console.log('Logout button handler attached');
        }
    } catch (error) {
        console.error('Error initializing auth:', error);
        updateUI(false, null, 'Error initializing authentication');
    }
}

// Update the DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Page loaded, checking URL parameters...');
    
    // Check if we're returning from auth
    if (window.location.search.includes('auth=success')) {
        console.log('Auth success detected, fetching user info...');
        try {
            const response = await fetch('/auth/status');
            const status = await response.json();
            
            // Update UI immediately with the user info
            updateUI(status.isAuthenticated, status.user);
            
            // Remove the auth=success parameter from URL without reloading
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        } catch (error) {
            console.error('Error fetching auth status:', error);
            updateUI(false);
        }
    }
    
    // Initialize auth in all cases
    initializeAuth();
});
