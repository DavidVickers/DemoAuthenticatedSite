// Note: The JWT signing library is included in index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/8.0.20/jsrsasign-all-min.js"></script>

let oktaAuth; // Currently not used; remove if not needed.

// Initialize authentication status when the page loads
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

initializeAuth();

// Login function: builds the authorization URL and redirects the browser to Okta
async function login() {
  try {
    console.log('Starting login process...');
    updateUI(false, null, 'Initiating login...');

    // First check if cookies are enabled
    if (!navigator.cookieEnabled) {
      throw new Error('Cookies must be enabled to login');
    }

    // Fetch configuration from your server
    const configResponse = await fetch('/config');
    const config = await configResponse.json();
    
    console.log('Config received:', {
      issuer: config.oktaIssuer,
      clientId: config.clientId,
      callbackUrl: config.callbackUrl
    });

    if (!config.oktaIssuer || !config.clientId) {
      throw new Error('Missing Okta configuration');
    }

    // Construct the authorization endpoint URL using the full issuer URL
    const authUrl = new URL(`${config.oktaIssuer}/v1/authorize`);
    
    const state = generateSessionId();
    const params = {
      client_id: config.clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: config.callbackUrl,
      state: state,
      prompt: 'login'  // Force fresh login
    };

    Object.entries(params).forEach(([key, value]) => {
      authUrl.searchParams.append(key, value);
    });

    const finalUrl = authUrl.toString();
    console.log('Redirecting to:', finalUrl);

    // Set a cookie to verify they work
    document.cookie = "okta_test=1; path=/; secure; samesite=lax";

    window.location.assign(finalUrl);
  } catch (error) {
    console.error('Login error:', error);
    updateUI(false, null, `Login error: ${error.message}`);
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
