// Import existing chat.js functionality
let isInitialized = false;

// Initialize embedded messaging (from existing chat.js)
function initializeChat() {
    if (isInitialized) {
        console.log('Chat already initialized');
        return;
    }

    try {
        console.log('Initializing embedded messaging...');
        embeddedservice_bootstrap.settings.language = 'en_US';
        embeddedservice_bootstrap.init(
            '00D4W000009FROd',
            'External_Site',
            'https://coralcloudresort-cd.my.site.com/ESWExternalSite1742408330641',
            {
                scrt2URL: 'https://coralcloudresort-cd.my.salesforce-scrt.com'
            }
        );
        isInitialized = true;
        // After successful initialization, set up timeout handlers
        setupChatTimeoutHandlers();
    } catch (err) {
        console.error('Error loading Embedded Messaging:', err);
        isInitialized = false;
    }
}

// =============== NEW TIMEOUT FUNCTIONALITY =============== //

// Configuration constants
const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
const WARNING_WAIT_TIME = 2 * 60 * 1000;   // 2 minutes in milliseconds

// Track chat state
let chatState = {
    lastActivityTimestamp: null,
    warningMessageSent: false,
    warningTimer: null,
    inactivityTimer: null,
    chatSessionId: null,
    caseId: null
};

/**
 * Set up all chat timeout handlers and event listeners
 */
function setupChatTimeoutHandlers() {
    // Listen for chat session start
    embeddedservice_bootstrap.addEventListener('onChatEstablished', (data) => {
        console.log('Chat session established');
        chatState.chatSessionId = data.chatSessionId;
        startInactivityMonitoring();
    });

    // Listen for user input
    embeddedservice_bootstrap.addEventListener('onChatUserInput', () => {
        resetInactivityTimer();
    });

    // Listen for agent messages
    embeddedservice_bootstrap.addEventListener('onAgentMessage', () => {
        resetInactivityTimer();
    });

    // Listen for chat end
    embeddedservice_bootstrap.addEventListener('onChatEndedByAgent', () => {
        cleanupChatTimers();
    });
}

/**
 * Start monitoring for user inactivity
 */
function startInactivityMonitoring() {
    resetInactivityTimer();
    console.log('Started inactivity monitoring');
}

/**
 * Reset the inactivity timer when there's user activity
 */
function resetInactivityTimer() {
    // Clear existing timers
    if (chatState.inactivityTimer) {
        clearTimeout(chatState.inactivityTimer);
    }
    if (chatState.warningTimer) {
        clearTimeout(chatState.warningTimer);
    }

    // Reset warning state
    chatState.warningMessageSent = false;
    chatState.lastActivityTimestamp = Date.now();

    // Set new inactivity timer
    chatState.inactivityTimer = setTimeout(() => {
        handleUserInactivity();
    }, INACTIVITY_TIMEOUT);

    console.log('Inactivity timer reset');
}

/**
 * Handle when user becomes inactive
 */
function handleUserInactivity() {
    if (!chatState.warningMessageSent) {
        sendWarningMessage();
        startWarningTimer();
    }
}

/**
 * Send warning message to user about impending chat closure
 */
function sendWarningMessage() {
    try {
        // Use Salesforce API to send agent message
        embeddedservice_bootstrap.sendAgentMessage({
            message: "It looks like you have left the chat. I am going to go ahead and close the chat if you have no objections"
        });
        chatState.warningMessageSent = true;
        console.log('Warning message sent to user');
    } catch (error) {
        console.error('Error sending warning message:', error);
    }
}

/**
 * Start timer for waiting after warning message
 */
function startWarningTimer() {
    chatState.warningTimer = setTimeout(() => {
        closeInactiveChat();
    }, WARNING_WAIT_TIME);
    console.log('Warning timer started');
}

/**
 * Close the chat session and update Salesforce case
 */
async function closeInactiveChat() {
    try {
        // End the chat session
        await embeddedservice_bootstrap.endChat({
            reason: 'User Inactivity'
        });

        // Update the Salesforce case
        await updateSalesforceCase();

        // Cleanup timers and state
        cleanupChatTimers();
        console.log('Chat closed due to inactivity');
    } catch (error) {
        console.error('Error closing inactive chat:', error);
    }
}

/**
 * Update the associated Salesforce case
 */
async function updateSalesforceCase() {
    try {
        // Make API call to Salesforce to update case
        const response = await fetch('/api/salesforce/case/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatSessionId: chatState.chatSessionId,
                status: 'Closed - Customer Inactive',
                reason: 'User inactivity timeout'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update Salesforce case');
        }

        console.log('Salesforce case updated successfully');
    } catch (error) {
        console.error('Error updating Salesforce case:', error);
    }
}

/**
 * Clean up all timers and reset chat state
 */
function cleanupChatTimers() {
    if (chatState.inactivityTimer) {
        clearTimeout(chatState.inactivityTimer);
    }
    if (chatState.warningTimer) {
        clearTimeout(chatState.warningTimer);
    }

    // Reset chat state
    chatState = {
        lastActivityTimestamp: null,
        warningMessageSent: false,
        warningTimer: null,
        inactivityTimer: null,
        chatSessionId: null,
        caseId: null
    };

    console.log('Chat timers and state cleaned up');
}

// Export for use in other files
window.initializeChat = initializeChat; 