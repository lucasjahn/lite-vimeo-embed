/**
 * Enhanced lite-vimeo-embed with private video support
 * Provides fast-loading Vimeo video embeds with support for both public and private videos
 *
 * Key improvements:
 * - Private/unlisted video support via privacy hash detection
 * - Dual API strategy (V2 + oEmbed) with intelligent fallback
 * - Enhanced error handling and resilience
 * - Backward compatibility maintained
 */

import {
  parseVideoIdentifier,
  validateVideoId,
  validatePrivacyHash,
  isPrivateVideo,
  createIframeUrl
} from './src/utils/privacy-hash-parser.js';

import {
  createAPIRouter,
  VimeoAPIError
} from './src/api/vimeo-api-client.js';

// Inject CSS styles (same as original)
const style = document.head.appendChild(document.createElement('style'));
style.textContent = /*css*/`

  lite-vimeo {
    aspect-ratio: 16 / 9;
    background-color: #000;
    position: relative;
    display: block;
    contain: content;
    background-position: center center;
    background-size: cover;
    cursor: pointer;
  }

  lite-vimeo > iframe {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
  }

  lite-vimeo > .ltv-playbtn {
    font-size: 10px;
    padding: 0;
    width: 6.5em;
    height: 4em;
    background: rgba(23, 35, 34, .75);
    z-index: 1;
    opacity: .8;
    border-radius: .5em;
    transition: opacity .2s ease-out, background .2s ease-out;
    outline: 0;
    border: 0;
    cursor: pointer;
  }

  lite-vimeo:hover > .ltv-playbtn {
    background-color: rgb(0, 173, 239);
    opacity: 1;
  }

  /* play button triangle */
  lite-vimeo > .ltv-playbtn::before {
    content: '';
    border-style: solid;
    border-width: 10px 0 10px 20px;
    border-color: transparent transparent transparent #fff;
  }

  lite-vimeo > .ltv-playbtn,
  lite-vimeo > .ltv-playbtn::before {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
  }

  /* Post-click styles */
  lite-vimeo.ltv-activated {
    cursor: unset;
  }

  lite-vimeo.ltv-activated::before,
  lite-vimeo.ltv-activated > .ltv-playbtn {
    opacity: 0;
    pointer-events: none;
  }

  /* Error state styles */
  lite-vimeo.ltv-error {
    background-color: #333;
    cursor: default;
  }

  lite-vimeo.ltv-error > .ltv-playbtn {
    background: rgba(255, 0, 0, 0.75);
  }

  lite-vimeo.ltv-error > .ltv-playbtn::before {
    border-style: solid;
    border-width: 8px;
    border-color: transparent;
    width: 4px;
    height: 4px;
    background: #fff;
    border-radius: 50%;
  }
`;

/**
 * Enhanced LiteVimeo component with private video support
 * Maintains backward compatibility while adding new features
 */
class LiteVimeoEnhanced extends (globalThis.HTMLElement ?? class {}) {
  constructor() {
    super();
    this.apiRouter = createAPIRouter({ timeout: 10000 });
    this.metadata = null;
    this.identifier = null;
    this.isInitialized = false;
  }

  /**
   * Observed attributes for reactivity
   */
  static get observedAttributes() {
    return ['videoid', 'privacy-hash', 'video-url', 'params', 'playlabel'];
  }

  /**
   * Begin pre-connecting to warm up the iframe load
   */
  static _warmConnections() {
    if (LiteVimeoEnhanced.preconnected) return;
    LiteVimeoEnhanced.preconnected = true;

    // The iframe document and most of its subresources come right off player.vimeo.com
    addPrefetch('preconnect', 'https://player.vimeo.com');
    // Images
    addPrefetch('preconnect', 'https://i.vimeocdn.com');
    // Files .js, .css
    addPrefetch('preconnect', 'https://f.vimeocdn.com');
    // Metrics
    addPrefetch('preconnect', 'https://fresnel.vimeocdn.com');
    // oEmbed API
    addPrefetch('preconnect', 'https://vimeo.com');
  }

  /**
   * Component lifecycle - connected to DOM
   */
  async connectedCallback() {
    if (this.isInitialized) return;

    try {
      await this.initializeComponent();
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Attribute change handler
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.isInitialized) {
      // Re-initialize when attributes change
      this.isInitialized = false;
      this.connectedCallback();
    }
  }

  /**
   * Initialize the component with enhanced video support
   */
  async initializeComponent() {
    try {
      // Parse video identifier from attributes
      this.identifier = this.parseVideoIdentifier();

      // Validate inputs
      this.validateIdentifier(this.identifier);

      // Fetch metadata using appropriate API strategy
      this.metadata = await this.apiRouter.fetchVideoMetadata(this.identifier);

      // Setup component UI
      this.setupThumbnail();
      this.setupPlayButton();
      this.setupAccessibility();

      this.isInitialized = true;

      // Dispatch ready event
      this.dispatchEvent(new CustomEvent('lite-vimeo-ready', {
        detail: {
          videoId: this.identifier.videoId,
          title: this.metadata.title,
          isPrivate: isPrivateVideo(this.identifier)
        }
      }));

    } catch (error) {
      console.warn('LiteVimeo initialization failed:', error.message);
      this.handleError(error);
    }
  }

  /**
   * Parse video identifier from component attributes
   */
  parseVideoIdentifier() {
    const videoUrl = this.getAttribute('video-url');
    const videoId = this.getAttribute('videoid');
    const privacyHash = this.getAttribute('privacy-hash');

    if (videoUrl) {
      return parseVideoIdentifier(videoUrl);
    } else if (videoId) {
      return parseVideoIdentifier(videoId, privacyHash);
    } else {
      throw new Error('Either video-url or videoid attribute is required');
    }
  }

  /**
   * Validate parsed video identifier
   */
  validateIdentifier(identifier) {
    if (!validateVideoId(identifier.videoId)) {
      throw new Error(`Invalid video ID: ${identifier.videoId}`);
    }

    if (identifier.privacyHash && !validatePrivacyHash(identifier.privacyHash)) {
      throw new Error(`Invalid privacy hash: ${identifier.privacyHash}`);
    }
  }

  /**
   * Setup video thumbnail from metadata
   */
  setupThumbnail() {
    if (!this.metadata || !this.metadata.thumbnailUrl) return;

    // Calculate optimal thumbnail dimensions
    const { width, height } = getThumbnailDimensions(this.getBoundingClientRect());
    let devicePixelRatio = window.devicePixelRatio || 1;
    if (devicePixelRatio >= 2) devicePixelRatio *= 0.75;

    const scaledWidth = Math.round(width * devicePixelRatio);
    const scaledHeight = Math.round(height * devicePixelRatio);

    // Optimize thumbnail URL if it's a Vimeo CDN URL
    let thumbnailUrl = this.metadata.thumbnailUrl;
    if (thumbnailUrl.includes('vimeocdn.com')) {
      thumbnailUrl = thumbnailUrl.replace(/-d_[\dx]+$/i, `-d_${scaledWidth}x${scaledHeight}`);
    }

    this.style.backgroundImage = `url("${thumbnailUrl}")`;
  }

  /**
   * Setup play button with enhanced functionality
   */
  setupPlayButton() {
    let playBtnEl = this.querySelector('.ltv-playbtn');

    // Get play label
    this.playLabel = (playBtnEl && playBtnEl.textContent.trim()) ||
                     this.getAttribute('playlabel') ||
                     `Play video${this.metadata ? ': ' + this.metadata.title : ''}`;

    // Create play button if it doesn't exist
    if (!playBtnEl) {
      playBtnEl = document.createElement('button');
      playBtnEl.type = 'button';
      playBtnEl.classList.add('ltv-playbtn');
      this.append(playBtnEl);
    }

    // Setup button attributes
    playBtnEl.setAttribute('aria-label', this.playLabel);
    playBtnEl.removeAttribute('href');

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup accessibility features
   */
  setupAccessibility() {
    // Ensure component is focusable and has proper ARIA attributes
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }

    this.setAttribute('role', 'button');
    this.setAttribute('aria-label', this.playLabel);

    // Add keyboard navigation
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.addIframe();
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Warm connections on hover
    this.addEventListener('pointerover', LiteVimeoEnhanced._warmConnections, {
      once: true
    });

    // Handle click to play
    this.addEventListener('click', this.addIframe.bind(this));
  }

  /**
   * Create and add the iframe for video playback
   */
  addIframe() {
    if (this.classList.contains('ltv-activated')) return;

    try {
      this.classList.add('ltv-activated');

      const iframeEl = document.createElement('iframe');
      iframeEl.width = (this.metadata?.width || 640).toString();
      iframeEl.height = (this.metadata?.height || 360).toString();
      iframeEl.title = this.playLabel;
      iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframeEl.allowFullscreen = true;

      // Create iframe URL with proper parameters including privacy hash
      const params = this.getAttribute('params') || '';
      iframeEl.src = createIframeUrl(this.identifier, params);

      this.append(iframeEl);

      // Set focus for accessibility
      iframeEl.addEventListener('load', () => iframeEl.focus(), { once: true });

      // Dispatch play event
      this.dispatchEvent(new CustomEvent('lite-vimeo-play', {
        detail: {
          videoId: this.identifier.videoId,
          title: this.metadata?.title || 'Unknown',
          isPrivate: isPrivateVideo(this.identifier)
        }
      }));

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle errors gracefully with fallback
   */
  handleError(error) {
    console.error('LiteVimeo Error:', error);

    // Add error class for styling
    this.classList.add('ltv-error');

    // Try to create fallback iframe if we have a video ID
    if (this.identifier && this.identifier.videoId) {
      this.createFallbackIframe();
    } else {
      // Show error state in play button
      const playBtn = this.querySelector('.ltv-playbtn');
      if (playBtn) {
        playBtn.setAttribute('aria-label', 'Video unavailable');
        playBtn.style.cursor = 'not-allowed';
      }
    }

    // Dispatch error event
    this.dispatchEvent(new CustomEvent('lite-vimeo-error', {
      detail: {
        error: error.message,
        videoId: this.identifier?.videoId || 'unknown',
        isPrivate: this.identifier ? isPrivateVideo(this.identifier) : false
      }
    }));
  }

  /**
   * Create fallback iframe when metadata fetch fails
   */
  createFallbackIframe() {
    if (!this.identifier) return;

    try {
      const iframeEl = document.createElement('iframe');
      iframeEl.width = '640';
      iframeEl.height = '360';
      iframeEl.title = this.playLabel || 'Vimeo video player';
      iframeEl.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      iframeEl.allowFullscreen = true;

      const params = this.getAttribute('params') || '';
      iframeEl.src = createIframeUrl(this.identifier, params);

      // Replace content with iframe
      this.innerHTML = '';
      this.appendChild(iframeEl);

      console.info('LiteVimeo: Fallback iframe created');

    } catch (fallbackError) {
      console.error('LiteVimeo: Fallback iframe creation failed:', fallbackError);
    }
  }

  /**
   * Public API: Refresh the component (reload metadata)
   */
  async refresh() {
    this.isInitialized = false;
    this.classList.remove('ltv-activated', 'ltv-error');
    this.style.backgroundImage = '';
    this.innerHTML = '';
    await this.connectedCallback();
  }

  /**
   * Public API: Get current video information
   */
  getVideoInfo() {
    return {
      identifier: this.identifier,
      metadata: this.metadata,
      isInitialized: this.isInitialized,
      isPrivate: this.identifier ? isPrivateVideo(this.identifier) : false
    };
  }
}

// Register the enhanced component, maintaining backward compatibility
if (globalThis.customElements && !globalThis.customElements.get('lite-vimeo')) {
  globalThis.customElements.define('lite-vimeo', LiteVimeoEnhanced);
}

/**
 * Utility functions (preserved from original)
 */

/**
 * Add a <link rel={preload | preconnect} ...> to the head
 */
function addPrefetch(kind, url, as) {
  const linkElem = document.createElement('link');
  linkElem.rel = kind;
  linkElem.href = url;
  if (as) {
    linkElem.as = as;
  }
  linkElem.crossorigin = true;
  document.head.append(linkElem);
}

/**
 * Get the thumbnail dimensions to use for a given player size.
 */
function getThumbnailDimensions({ width, height }) {
  let roundedWidth = width;
  let roundedHeight = height;

  // If the original width is a multiple of 320 then we should
  // not round up. This is to keep the native image dimensions
  // so that they match up with the actual frames from the video.
  //
  // For example 640x360, 960x540, 1280x720, 1920x1080
  //
  // Round up to nearest 100 px to improve cacheability at the
  // CDN. For example, any width between 601 pixels and 699
  // pixels will render the thumbnail at 700 pixels width.
  if (roundedWidth % 320 !== 0) {
    roundedWidth = Math.ceil(width / 100) * 100;
    roundedHeight = Math.round((roundedWidth / width) * height);
  }

  return {
    width: roundedWidth,
    height: roundedHeight
  };
}

// Export for module usage
export { LiteVimeoEnhanced as LiteVimeo };
export default LiteVimeoEnhanced;