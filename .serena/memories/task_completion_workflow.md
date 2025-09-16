# Task Completion Workflow

## Required Steps After Code Changes

### 1. Code Quality Check
```bash
npm run lint
```
- **Must Pass**: ESLint checks are enforced in CI
- Fix any linting errors before committing

### 2. Manual Testing
```bash
npm run dev
```
- Test the component in browser
- Check all variants:
  - `index.html` - Main demo
  - `variants/solo.html` - Isolated component
  - `variants/pe.html` - Progressive enhancement
  - `variants/vimeo.html` - Comparison demo

### 3. Cross-browser Testing
- Test in modern browsers supporting ES modules
- Verify custom element functionality
- Check thumbnail loading and video playback

### 4. Git Workflow
```bash
git add .
git commit -m "descriptive commit message"
```
- Use descriptive commit messages
- Reference issue numbers if applicable

## CI/CD Pipeline
- **Automatic**: Runs on push/PR
- **Checks**: Linting via `npm run lint`
- **Deployment**: CD workflow handles releases

## Performance Considerations
- Keep bundle size minimal (zero runtime dependencies)
- Test loading performance vs standard iframe embeds
- Verify thumbnail loading efficiency