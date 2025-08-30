# Deployment Guide

## Pre-Upload Checklist

Before uploading to GitHub, ensure you have:

- [x] ✅ Removed all hardcoded localhost URLs
- [x] ✅ Created environment configuration system
- [x] ✅ Added comprehensive .gitignore
- [x] ✅ Removed test files and sensitive scripts
- [x] ✅ Created detailed README.md
- [x] ✅ Added security policy
- [x] ✅ Created GitHub Actions workflow
- [x] ✅ Updated package.json (removed proxy)

## GitHub Upload Steps

### 1. Initialize Git Repository (if not already done)

```bash
git init
git add .
git commit -m "Initial commit: FindDocs RAG Application"
```

### 2. Add Remote Origin

```bash
git remote add origin https://github.com/Gurpreethgnis/FindDocs.git
```

### 3. Push to GitHub

```bash
git branch -M main
git push -u origin main
```

## Post-Upload Tasks

### 1. Update Repository Settings

- [ ] Set repository to public
- [ ] Enable GitHub Issues
- [ ] Enable GitHub Discussions
- [ ] Set up branch protection rules

### 2. Configure GitHub Actions

- [ ] Ensure CI workflow is enabled
- [ ] Set up Codecov integration (optional)
- [ ] Configure dependency scanning

### 3. Repository Features

- [ ] Add repository topics: `rag`, `ai`, `document-processing`, `react`, `ollama`
- [ ] Set repository description
- [ ] Add repository website (if deployed)

## Environment Setup for Users

### Development Environment

```bash
# Clone repository
git clone https://github.com/Gurpreethgnis/FindDocs.git
cd FindDocs

# Install dependencies
npm install

# Create environment file
cp env.template .env.local

# Edit .env.local with your settings
# REACT_APP_DOCLING_URL=http://localhost:35111
# REACT_APP_OLLAMA_URL=/api

# Start development server
npm start
```

### Production Environment

```bash
# Build for production
npm run build

# Serve static files
npx serve -s build -l 3000
```

## Security Notes

- **No sensitive data** is included in the repository
- **Environment variables** are used for configuration
- **Local processing only** - no cloud dependencies
- **Docker containers** are properly configured

## Support

For deployment issues:
1. Check the README.md for detailed setup instructions
2. Review the troubleshooting section
3. Open a GitHub Issue for specific problems
