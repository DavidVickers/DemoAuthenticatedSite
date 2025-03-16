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

    // Fetch configuration from your server
    const configResponse = await fetch('/config');
    const config = await configResponse.json();
    
    // Add debug logging
    console.log('Received config:', {
      issuer: config.oktaIssuer,
      clientId: config.clientId,
      callbackUrl: config.callbackUrl
    });
    
    if (!config.oktaIssuer || !config.clientId || !config.callbackUrl) {
      throw new Error('Missing required configuration');
    }

    // Generate state
    const state = generateSessionId();

    // Get base domain from issuer URL
    const oktaDomain = config.oktaIssuer.replace('/oauth2/default', '');
    console.log('Using Okta domain:', oktaDomain);
    
    // Construct authorization URL
    const authUrl = new URL(`${oktaDomain}/oauth2/v1/authorize`);
    
    const params = {
      client_id: config.clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: config.callbackUrl,
      state: state
    };

    // Log the parameters
    console.log('Auth parameters:', params);

    Object.entries(params).forEach(([key, value]) => {
      authUrl.searchParams.append(key, value);
    });

    const finalUrl = authUrl.toString();
    console.log('Final redirect URL:', finalUrl);

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
