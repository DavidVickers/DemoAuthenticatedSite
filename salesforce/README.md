# Salesforce Chat Development

## Overview
Enhanced chat functionality including timeout management and case automation.

## Features
- Chat timeout handling
- Automated case updates
- Custom Apex classes
- Event-driven architecture

## Components

### ChatWithTimeout.js
- Inactivity monitoring
- Automated warning messages
- Case status updates
- Session management

### Apex Classes
```apex
// ChatCaseManager.cls
public class ChatCaseManager {
    // Case management functionality
}
```

## Configuration

### Chat Timeout Settings
- Inactivity timeout: 20 minutes
- Warning period: 2 minutes
- Automated messages configured

### Case Management
- Automatic case closure
- Status updates
- Audit logging

## Development

### Local Setup
1. Install Salesforce CLI
2. Authenticate with your org
3. Deploy components:
   ```bash
   sfdx force:source:deploy
   ```

### Testing
```bash
sfdx force:apex:test:run
```

## Integration
See [integration guide](../docs/integration.md) for details on connecting with Heroku application 