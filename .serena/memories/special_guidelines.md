# Special Guidelines and Design Patterns

## Web Components Best Practices
- **Custom Elements**: Follows `lite-vimeo` naming convention (kebab-case)
- **Lifecycle Methods**: Uses `connectedCallback()` for initialization
- **Attribute Handling**: Reads `videoid` attribute for Vimeo video ID
- **Event Handling**: Click events to trigger video loading
- **Shadow DOM**: Not used - styles injected globally for simplicity

## Performance Patterns
- **Lazy Loading**: Only loads actual Vimeo iframe on user interaction
- **Thumbnail First**: Shows static background image before interaction
- **Prefetch Strategy**: Uses `addPrefetch()` for DNS prefetching
- **Minimal Bundle**: Zero runtime dependencies approach

## Progressive Enhancement
- **Graceful Degradation**: Works without JavaScript (static thumbnail)
- **Enhanced Experience**: JavaScript adds interactive functionality
- **CSS-First Approach**: Core styling works without JS

## API Integration
- **Vimeo API**: Direct integration for thumbnail and embed data
- **Background Images**: Uses `background-image` CSS for thumbnails
- **Dynamic Loading**: Creates iframe elements on demand

## Browser Compatibility
- **Modern Browsers**: Targets ES module support
- **Custom Elements**: Requires Custom Elements API
- **Fallback Strategy**: Provides static content for non-supporting browsers

## Development Philosophy
- **Single File Component**: Everything in one JS file for simplicity
- **Vanilla JavaScript**: No framework dependencies
- **Web Standards**: Uses platform APIs over abstractions
- **Performance First**: Every decision optimized for speed