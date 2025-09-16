# Suggested Commands for Development

## Core Development Commands

### Linting
```bash
npm run lint
# Runs ESLint with wet-run configuration on all .js files
```

### Development Server
```bash
npm run dev
# Starts development server using 'wet serve'
# Serves the project locally for testing
```

### Package Management
```bash
npm install        # Install dependencies
npm ci            # Clean install (used in CI)
```

### Testing the Component
```bash
# Start dev server
npm run dev
# Then open browser to test different variants:
# - index.html (main demo)
# - variants/solo.html (isolated component)
# - variants/pe.html (progressively enhanced)
# - variants/vimeo.html (comparison with regular embed)
```

## Git Workflow
```bash
git status         # Check repository status
git log --oneline  # View commit history
git branch         # List branches
```

## macOS System Commands (Darwin)
```bash
ls -la            # List files with details
find . -name "*.js"  # Find JavaScript files
grep -r "pattern"    # Search for patterns
open .               # Open current directory in Finder
```

## CI/CD
- CI runs automatically on push/PR: linting check
- CD workflow available for releases