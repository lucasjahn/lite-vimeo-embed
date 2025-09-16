# Tech Stack and Architecture

## Core Technology
- **Language**: Modern JavaScript (ES modules)
- **Architecture**: Web Components / Custom Elements
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Main Entry**: `lite-vimeo-embed.js`

## Development Tools
- **Linting**: ESLint with `wet-run` configuration
- **Dev Server**: `wet serve` for development
- **Package Manager**: npm with package-lock.json

## Browser Target
- Modern browsers supporting ES modules and Custom Elements
- Distributed via CDN (jsdelivr.net)

## Key Components
- `LiteVimeo` class (main custom element)
- `addPrefetch` function
- `getThumbnailDimensions` function
- Embedded CSS styles

## Dependencies
- **Dev Dependencies**: `wet-run@^0.5.1` (development tooling)
- **Runtime**: Zero dependencies (vanilla JavaScript)