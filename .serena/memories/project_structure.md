# Project Structure

## Root Directory
```
lite-vimeo-embed/
├── lite-vimeo-embed.js    # Main component file
├── index.html             # Main demo page
├── package.json           # npm configuration
├── package-lock.json      # Dependency lock file
├── readme.md              # Documentation
├── CHANGELOG.md           # Version history
└── .gitignore            # Git ignore rules
```

## Variants Directory
```
variants/
├── solo.html              # Isolated component demo
├── pe.html               # Progressively enhanced demo
└── vimeo.html            # Standard vimeo comparison
```

## Configuration
```
.github/
├── workflows/
│   ├── ci.yml            # Continuous integration
│   └── cd.yml            # Continuous deployment
```

```
.serena/
└── project.yml           # Serena MCP configuration
```

## Key Files
- **lite-vimeo-embed.js**: Single-file Web Component with embedded CSS
- **index.html**: Main demo with links to variants
- **package.json**: ES module configuration, scripts, and metadata
- **variants/**: Different usage examples and comparisons

## Component Architecture
- Single JavaScript file containing:
  - CSS styles (embedded)
  - LiteVimeo class (Custom Element)
  - Helper functions (addPrefetch, getThumbnailDimensions)
  - Component registration