let embedded_svc;

function initializeChat() {
    if (!embedded_svc) {
        embedded_svc = window.embedded_svc;
    }

    // Replace with your Salesforce org's details
    embedded_svc.settings.displayHelpButton = true;
    embedded_svc.settings.language = '';
    embedded_svc.settings.enabledFeatures = ['LiveAgent'];
    embedded_svc.settings.entryFeature = 'LiveAgent';

    embedded_svc.init(
        'YOUR_SALESFORCE_DOMAIN',
        'YOUR_EXPERIENCE_SITE_URL',
        gslbBaseURL,
        'YOUR_ORG_ID',
        'YOUR_DEPLOYMENT_NAME',
        {
            baseLiveAgentContentURL: 'YOUR_LIVE_AGENT_CONTENT_URL',
            deploymentId: 'YOUR_DEPLOYMENT_ID',
            buttonId: 'YOUR_BUTTON_ID',
            baseLiveAgentURL: 'YOUR_LIVE_AGENT_URL',
            eswLiveAgentDevName: 'YOUR_LIVE_AGENT_DEV_NAME',
            isOfflineSupportEnabled: false
        }
    );
} 