# Code Style and Conventions

## JavaScript Style
- **ES Modules**: Uses `import/export` syntax
- **Modern JavaScript**: ES6+ features, classes, arrow functions
- **No External Dependencies**: Vanilla JavaScript approach
- **Custom Elements**: Follows Web Components standards

## Code Patterns Observed
- **Class-based Components**: `class LiteVimeo extends HTMLElement`
- **CSS-in-JS**: Embedded CSS using template literals with `/*css*/` comments
- **camelCase**: Function and variable naming (`addPrefetch`, `getThumbnailDimensions`)
- **Descriptive Names**: Clear, meaningful function and class names

## File Organization
- **Main Component**: `lite-vimeo-embed.js` (single file component)
- **Demo Files**: `index.html` and `variants/` directory
- **Package Config**: Standard `package.json` structure

## Linting Rules
- Uses ESLint with `wet-run/.eslintrc.json` configuration
- Enforced in CI pipeline
- Run with `npm run lint`

## Web Standards Compliance
- Custom Elements API
- ES Module standards
- Semantic HTML structure
- Progressive enhancement principles