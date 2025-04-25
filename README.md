# Salesforce Chat Integration Project

## Overview
This repository contains two main components:
1. A Heroku-hosted web application with Salesforce chat integration
2. Salesforce development code for enhanced chat functionality

## Repository Structure
project/
├── heroku/ # Heroku production application
│ └── README.md # Heroku-specific documentation
├── salesforce/ # Salesforce development
│ └── README.md # Salesforce-specific documentation
└── README.md # This file

## Components

### Heroku Application
- Live demo site with Okta authentication
- Salesforce embedded chat integration
- Session management
- For setup and deployment instructions, see [Heroku README](HerokuCode/README.md)

### Salesforce Development
- Enhanced chat timeout functionality
- Case management automation
- Custom Apex classes
- For configuration and development details, see [Salesforce README](salesforce/README.md)

## Branch Management
- `main`: Contains both Heroku and Salesforce code
- `heroku`: Production branch for Heroku deployments
- `salesforce-dev`: Salesforce-specific development

## Getting Started
1. For Heroku application setup, visit the [Heroku folder](heroku/)
2. For Salesforce development, visit the [Salesforce folder](salesforce/)

## License
MIT License - See LICENSE file for details.

![Authentication Flow](./READMEimages/UserVerificationFlow.png)
