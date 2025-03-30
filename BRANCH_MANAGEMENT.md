## Branch Management Commands

### Creating Branches
```bash
# Ensure you're on main branch
git checkout main

# Create Salesforce development branch
git checkout -b salesforce-dev
```

### Adding Salesforce-Specific Code
```bash
# Switch to Salesforce branch
git checkout salesforce-dev

# Add new files
git add ChatWithTimeout.js
git commit -m "Add chat timeout functionality for Salesforce org"
```

### Deployment Management

#### Heroku Deployments
```bash
# Deploy to Heroku (from main branch)
git checkout main
git push heroku main
```

#### Salesforce Development
```bash
# Push Salesforce changes
git checkout salesforce-dev
git push origin salesforce-dev
```

### Synchronizing Branches

#### Merging Salesforce Changes to Main
```bash
# Switch to main branch
git checkout main

# Merge Salesforce changes
git merge salesforce-dev --no-ff
```

## Best Practices

1. **Branch Usage**
   - Keep `main` branch clean for Heroku deployments
   - Develop Salesforce features in `salesforce-dev`
   - Use feature branches for specific developments

2. **Deployment Safety**
   - Always verify branch before deploying
   - Test changes in Salesforce sandbox before merging
   - Keep Heroku and Salesforce code separate

3. **Version Control**
   - Regular commits with clear messages
   - Proper documentation of changes
   - Maintain separate concerns in each branch

4. **Code Organization**
   - Clear folder structure
   - Separate Salesforce-specific code
   - Maintain documentation for both environments

## Common Commands Reference

### Branch Management
```bash
# View all branches
git branch

# Switch branches
git checkout <branch-name>

# Create new branch
git checkout -b <new-branch-name>
```

### Deployment
```bash
# Heroku deployment
git push heroku main

# Salesforce development
git push origin salesforce-dev
```

### Synchronization
```bash
# Update branch with latest changes
git pull origin <branch-name>

# Merge changes
git merge <branch-name>
```

## Notes
- Keep Heroku deployment code isolated
- Maintain clear separation between environments
- Document all Salesforce-specific configurations
- Use clear commit messages for each environment

# Managing Combined Heroku and Salesforce Repository

## Repository Structure
```bash
# Ensure you're on main branch
git checkout main

# Create Salesforce development branch
git checkout -b salesforce-dev
```