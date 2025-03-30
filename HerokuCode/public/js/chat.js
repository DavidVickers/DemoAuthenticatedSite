// Initialize embedded messaging
function initializeChat() {
    // Check if already initialized to prevent multiple initializations
    if (window.embeddedservice_bootstrap && window.embeddedservice_bootstrap.initialized) {
        console.log('Chat already initialized, skipping...');
        return;
    }

    try {
        console.log('Initializing embedded messaging...');
        embeddedservice_bootstrap.settings.language = 'en_US';

        // Add flag to track initialization
        window.embeddedservice_bootstrap.initialized = true;

        embeddedservice_bootstrap.init(
            '00D4W000009FROd',
            'External_Site',
            'https://coralcloudresort-cd.my.site.com/ESWExternalSite1742408330641',
            {
                scrt2URL: 'https://coralcloudresort-cd.my.salesforce-scrt.com'
            }
        );
    } catch (err) {
        console.error('Error loading Embedded Messaging: ', err);
    }
}

// Initialize only once when the script loads
document.addEventListener('DOMContentLoaded', () => {
    // Remove any existing event listeners to prevent duplicates
    window.removeEventListener("onEmbeddedMessagingReady", initializeChat);
    
    // Initialize chat once
    initializeChat();
});

// Export for use in other files
window.initializeChat = initializeChat;
