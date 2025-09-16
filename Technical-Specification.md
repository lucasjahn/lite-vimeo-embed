# lite-vimeo-embed Technical Specification

## Overview

This technical specification provides detailed implementation guidance for the lite-vimeo-embed 2025 modernization project. It covers API integration patterns, component architecture, data flow, and technical implementation details for all three phases.

## Core Architecture

### Current Architecture Analysis

```javascript
// Current v0.3.0 Structure
const style = /* CSS injection */;

class LiteVimeo extends HTMLElement {
  connectedCallback() {
    // Simple video ID extraction
    // Single API call to v2 endpoint
    // Direct thumbnail and iframe setup
  }
}

customElements.define('lite-vimeo', LiteVimeo);
```

**Limitations**:
- Single API strategy (public v2 only)
- No privacy hash support
- Limited error handling
- No type safety
- Minimal accessibility features

### Target Architecture (Post-Modernization)

```typescript
// Target v1.0.0 Structure
interface VimeoAPIClient {
  fetchMetadata(video: VideoIdentifier): Promise<VideoMetadata>;
}

interface VideoIdentifier {
  videoId: string;
  privacyHash?: string;
  isPrivate: boolean;
}

class LiteVimeo extends HTMLElement {
  private apiClient: VimeoAPIClient;
  private config: LiteVimeoConfig;
  private metadata: VideoMetadata | null = null;

  connectedCallback() {
    // Enhanced parsing and validation
    // Intelligent API strategy selection
    // Progressive enhancement setup
    // Accessibility initialization
  }
}
```

## Phase 1: Private Video Support - Technical Details

### 1.1 Privacy Hash Detection

#### URL Pattern Analysis
```typescript
interface PrivacyPattern {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => { videoId: string; privacyHash: string };
}

const PRIVACY_PATTERNS: PrivacyPattern[] = [
  {
    // https://vimeo.com/123456789/abc123def456
    pattern: /vimeo\.com\/(\d+)\/([a-f0-9]+)/i,
    extractor: (match) => ({
      videoId: match[1],
      privacyHash: match[2]
    })
  },
  {
    // https://player.vimeo.com/video/123456789?h=abc123def456
    pattern: /player\.vimeo\.com\/video\/(\d+).*[?&]h=([a-f0-9]+)/i,
    extractor: (match) => ({
      videoId: match[1],
      privacyHash: match[2]
    })
  }
];

class VideoIdentifierParser {
  static parse(input: string, privacyHashAttr?: string): VideoIdentifier {
    // Try URL patterns first
    for (const {pattern, extractor} of PRIVACY_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        const {videoId, privacyHash} = extractor(match);
        return {
          videoId,
          privacyHash,
          isPrivate: true
        };
      }
    }

    // Fallback to videoid + privacy-hash attributes
    const videoId = this.extractVideoId(input);
    if (privacyHashAttr) {
      return {
        videoId,
        privacyHash: privacyHashAttr,
        isPrivate: true
      };
    }

    return {
      videoId,
      isPrivate: false
    };
  }
}
```

#### Input Validation & Sanitization
```typescript
class InputValidator {
  private static readonly VIDEO_ID_PATTERN = /^\d{1,12}$/;
  private static readonly PRIVACY_HASH_PATTERN = /^[a-f0-9]{12}$/i;

  static validateVideoId(videoId: string): boolean {
    return this.VIDEO_ID_PATTERN.test(videoId);
  }

  static validatePrivacyHash(hash: string): boolean {
    return this.PRIVACY_HASH_PATTERN.test(hash);
  }

  static sanitizeInput(input: string): string {
    // Remove potentially malicious characters
    return input.replace(/[<>'"&]/g, '').trim();
  }
}
```

### 1.2 Dual API Strategy Implementation

#### API Client Architecture
```typescript
interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  duration: number;
  authorName: string;
  privacyHash?: string;
}

abstract class VimeoAPIClient {
  protected abstract endpoint: string;
  protected abstract fetchRaw(identifier: VideoIdentifier): Promise<any>;
  protected abstract parseResponse(response: any): VideoMetadata;

  async fetchMetadata(identifier: VideoIdentifier): Promise<VideoMetadata> {
    try {
      const rawResponse = await this.fetchRaw(identifier);
      return this.parseResponse(rawResponse);
    } catch (error) {
      throw new VimeoAPIError(`Failed to fetch video metadata: ${error.message}`);
    }
  }
}

class VimeoV2APIClient extends VimeoAPIClient {
  protected endpoint = 'https://vimeo.com/api/v2/video';

  protected async fetchRaw(identifier: VideoIdentifier): Promise<any> {
    if (identifier.isPrivate) {
      throw new VimeoAPIError('V2 API does not support private videos');
    }

    const response = await fetch(`${this.endpoint}/${identifier.videoId}.json`);
    if (!response.ok) {
      throw new VimeoAPIError(`V2 API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data[0]; // V2 returns array
  }

  protected parseResponse(response: any): VideoMetadata {
    return {
      videoId: response.id.toString(),
      title: response.title,
      description: response.description,
      thumbnailUrl: response.thumbnail_large,
      width: response.width,
      height: response.height,
      duration: response.duration,
      authorName: response.user_name
    };
  }
}

class VimeoOEmbedAPIClient extends VimeoAPIClient {
  protected endpoint = 'https://vimeo.com/api/oembed.json';

  protected async fetchRaw(identifier: VideoIdentifier): Promise<any> {
    const videoUrl = identifier.isPrivate
      ? `https://vimeo.com/${identifier.videoId}/${identifier.privacyHash}`
      : `https://vimeo.com/${identifier.videoId}`;

    const oembedUrl = `${this.endpoint}?url=${encodeURIComponent(videoUrl)}`;

    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new VimeoAPIError(`oEmbed API request failed: ${response.status}`);
    }

    return await response.json();
  }

  protected parseResponse(response: any): VideoMetadata {
    // Extract video ID from oEmbed response
    const videoId = this.extractVideoIdFromHtml(response.html);

    return {
      videoId,
      title: response.title,
      description: response.description || '',
      thumbnailUrl: response.thumbnail_url,
      width: response.width,
      height: response.height,
      duration: response.duration || 0,
      authorName: response.author_name,
      privacyHash: this.extractPrivacyHash(response.html)
    };
  }

  private extractVideoIdFromHtml(html: string): string {
    const match = html.match(/video\/(\d+)/);
    return match ? match[1] : '';
  }

  private extractPrivacyHash(html: string): string | undefined {
    const match = html.match(/[?&]h=([a-f0-9]+)/i);
    return match ? match[1] : undefined;
  }
}
```

#### API Strategy Router
```typescript
class APIStrategyRouter {
  private v2Client = new VimeoV2APIClient();
  private oembedClient = new VimeoOEmbedAPIClient();

  async fetchVideoMetadata(identifier: VideoIdentifier): Promise<VideoMetadata> {
    if (identifier.isPrivate) {
      // Private videos require oEmbed API
      try {
        return await this.oembedClient.fetchMetadata(identifier);
      } catch (error) {
        // Fallback: try without privacy hash (might be unlisted but accessible)
        const publicIdentifier = { ...identifier, isPrivate: false };
        return await this.v2Client.fetchMetadata(publicIdentifier);
      }
    } else {
      // Public videos use faster V2 API
      try {
        return await this.v2Client.fetchMetadata(identifier);
      } catch (error) {
        // Fallback: try oEmbed API
        return await this.oembedClient.fetchMetadata(identifier);
      }
    }
  }
}
```

### 1.3 Enhanced Component Implementation

```typescript
class LiteVimeo extends HTMLElement {
  private apiRouter = new APIStrategyRouter();
  private metadata: VideoMetadata | null = null;
  private identifier: VideoIdentifier | null = null;

  // Observed attributes for reactivity
  static get observedAttributes() {
    return ['videoid', 'privacy-hash', 'video-url', 'params'];
  }

  connectedCallback() {
    this.initializeComponent();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.handleAttributeChange(name, newValue);
    }
  }

  private async initializeComponent() {
    try {
      // Parse video identifier from attributes
      this.identifier = this.parseVideoIdentifier();

      // Validate inputs
      this.validateIdentifier(this.identifier);

      // Fetch metadata using appropriate API
      this.metadata = await this.apiRouter.fetchVideoMetadata(this.identifier);

      // Setup component UI
      this.setupThumbnail();
      this.setupPlayButton();
      this.setupAccessibility();

    } catch (error) {
      this.handleError(error);
    }
  }

  private parseVideoIdentifier(): VideoIdentifier {
    const videoUrl = this.getAttribute('video-url');
    const videoId = this.getAttribute('videoid');
    const privacyHash = this.getAttribute('privacy-hash');

    if (videoUrl) {
      return VideoIdentifierParser.parse(videoUrl);
    } else if (videoId) {
      return VideoIdentifierParser.parse(videoId, privacyHash || undefined);
    } else {
      throw new Error('Either video-url or videoid attribute is required');
    }
  }

  private validateIdentifier(identifier: VideoIdentifier) {
    if (!InputValidator.validateVideoId(identifier.videoId)) {
      throw new Error(`Invalid video ID: ${identifier.videoId}`);
    }

    if (identifier.privacyHash && !InputValidator.validatePrivacyHash(identifier.privacyHash)) {
      throw new Error(`Invalid privacy hash: ${identifier.privacyHash}`);
    }
  }

  private setupThumbnail() {
    if (!this.metadata) return;

    this.style.backgroundImage = `url("${this.metadata.thumbnailUrl}")`;
    this.setAttribute('aria-label', `Play video: ${this.metadata.title}`);
  }

  private setupPlayButton() {
    const playButton = this.querySelector('.ltv-playbtn') as HTMLElement;
    if (playButton) {
      playButton.addEventListener('click', this.handlePlay.bind(this));
    }
  }

  private handlePlay() {
    if (!this.identifier || !this.metadata) return;

    // Create iframe with proper parameters
    const iframe = this.createVideoIframe();

    // Replace component content with iframe
    this.innerHTML = '';
    this.appendChild(iframe);

    // Trigger play event
    this.dispatchEvent(new CustomEvent('lite-vimeo-play', {
      detail: {
        videoId: this.identifier.videoId,
        title: this.metadata.title
      }
    }));
  }

  private createVideoIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    const params = new URLSearchParams(this.getAttribute('params') || '');

    // Add privacy hash if present
    if (this.identifier?.privacyHash) {
      params.set('h', this.identifier.privacyHash);
    }

    // Set default parameters
    params.set('autoplay', '1');
    params.set('byline', '0');
    params.set('portrait', '0');
    params.set('dnt', '1');

    // Configure iframe
    iframe.src = `https://player.vimeo.com/video/${this.identifier?.videoId}?${params.toString()}`;
    iframe.width = this.metadata?.width.toString() || '640';
    iframe.height = this.metadata?.height.toString() || '360';
    iframe.allowFullscreen = true;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';

    return iframe;
  }

  private handleError(error: Error) {
    console.error('LiteVimeo Error:', error);

    // Fallback to basic iframe
    this.createFallbackIframe();

    // Dispatch error event
    this.dispatchEvent(new CustomEvent('lite-vimeo-error', {
      detail: { error: error.message }
    }));
  }

  private createFallbackIframe() {
    if (!this.identifier) return;

    const iframe = this.createVideoIframe();
    this.innerHTML = '';
    this.appendChild(iframe);
  }
}
```

## Phase 2: Modern Standards - Technical Details

### 2.1 TypeScript Integration

#### Type Definitions
```typescript
// types/index.ts
export interface VimeoVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  duration: number;
  authorName: string;
  privacyHash?: string;
}

export interface VideoIdentifier {
  videoId: string;
  privacyHash?: string;
  isPrivate: boolean;
}

export interface LiteVimeoConfig {
  apiTimeout: number;
  retryAttempts: number;
  enableDebugMode: boolean;
  fallbackToIframe: boolean;
}

export interface LiteVimeoEventDetail {
  videoId: string;
  title?: string;
  error?: string;
}

// Custom element registration with types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lite-vimeo': Partial<{
        videoid: string;
        'privacy-hash': string;
        'video-url': string;
        params: string;
      }>;
    }
  }
}
```

#### Build Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts'],
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'LiteVimeoEmbed',
      formats: ['es', 'umd', 'iife']
    },
    rollupOptions: {
      output: {
        globals: {
          // No external dependencies
        }
      }
    },
    sourcemap: true,
    minify: 'terser',
    target: 'es2020'
  },
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95
      }
    }
  }
});
```

### 2.2 Testing Infrastructure

#### Test Utilities
```typescript
// tests/utils/test-utils.ts
import { beforeEach, afterEach } from 'vitest';

export class TestEnvironment {
  private container: HTMLElement;

  setup() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
  }

  teardown() {
    if (this.container) {
      document.body.removeChild(this.container);
    }
  }

  createElement(html: string): HTMLElement {
    this.container.innerHTML = html;
    return this.container.firstElementChild as HTMLElement;
  }
}

export const mockVimeoV2Response = {
  id: 123456789,
  title: 'Test Video',
  description: 'Test Description',
  thumbnail_large: 'https://example.com/thumb.jpg',
  width: 640,
  height: 360,
  duration: 120,
  user_name: 'Test User'
};

export const mockOEmbedResponse = {
  type: 'video',
  version: '1.0',
  provider_name: 'Vimeo',
  title: 'Test Private Video',
  description: 'Test Private Description',
  thumbnail_url: 'https://example.com/private-thumb.jpg',
  width: 640,
  height: 360,
  duration: 180,
  author_name: 'Private User',
  html: '<iframe src="https://player.vimeo.com/video/123456789?h=abc123def456"></iframe>'
};
```

#### Unit Tests
```typescript
// tests/unit/video-identifier-parser.test.ts
import { describe, test, expect } from 'vitest';
import { VideoIdentifierParser } from '../../src/utils/video-identifier-parser';

describe('VideoIdentifierParser', () => {
  describe('parse', () => {
    test('should parse public video ID', () => {
      const result = VideoIdentifierParser.parse('123456789');

      expect(result).toEqual({
        videoId: '123456789',
        isPrivate: false
      });
    });

    test('should parse private video URL with hash', () => {
      const url = 'https://vimeo.com/123456789/abc123def456';
      const result = VideoIdentifierParser.parse(url);

      expect(result).toEqual({
        videoId: '123456789',
        privacyHash: 'abc123def456',
        isPrivate: true
      });
    });

    test('should parse player URL with hash parameter', () => {
      const url = 'https://player.vimeo.com/video/123456789?h=abc123def456';
      const result = VideoIdentifierParser.parse(url);

      expect(result).toEqual({
        videoId: '123456789',
        privacyHash: 'abc123def456',
        isPrivate: true
      });
    });

    test('should handle privacy hash attribute', () => {
      const result = VideoIdentifierParser.parse('123456789', 'abc123def456');

      expect(result).toEqual({
        videoId: '123456789',
        privacyHash: 'abc123def456',
        isPrivate: true
      });
    });
  });
});
```

#### Integration Tests
```typescript
// tests/integration/api-strategy-router.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { APIStrategyRouter } from '../../src/api/api-strategy-router';
import { mockVimeoV2Response, mockOEmbedResponse } from '../utils/test-utils';

describe('APIStrategyRouter Integration', () => {
  let router: APIStrategyRouter;

  beforeEach(() => {
    router = new APIStrategyRouter();

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  test('should use V2 API for public videos', async () => {
    const mockResponse = [mockVimeoV2Response];
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as Response);

    const identifier = { videoId: '123456789', isPrivate: false };
    const result = await router.fetchVideoMetadata(identifier);

    expect(fetch).toHaveBeenCalledWith('https://vimeo.com/api/v2/video/123456789.json');
    expect(result.videoId).toBe('123456789');
    expect(result.title).toBe('Test Video');
  });

  test('should use oEmbed API for private videos', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOEmbedResponse
    } as Response);

    const identifier = {
      videoId: '123456789',
      privacyHash: 'abc123def456',
      isPrivate: true
    };
    const result = await router.fetchVideoMetadata(identifier);

    expect(fetch).toHaveBeenCalledWith(
      'https://vimeo.com/api/oembed.json?url=https%3A//vimeo.com/123456789/abc123def456'
    );
    expect(result.title).toBe('Test Private Video');
  });

  test('should fallback when primary API fails', async () => {
    // First call fails (V2 API)
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('404 Not Found'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockOEmbedResponse
      } as Response);

    const identifier = { videoId: '123456789', isPrivate: false };
    const result = await router.fetchVideoMetadata(identifier);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.title).toBe('Test Private Video');
  });
});
```

### 2.3 Performance Optimization

#### Intersection Observer Implementation
```typescript
// src/utils/intersection-observer.ts
export class VideoIntersectionObserver {
  private observer: IntersectionObserver;
  private elements: Map<Element, () => void> = new Map();

  constructor(options: IntersectionObserverInit = { threshold: 0.1 }) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      options
    );
  }

  observe(element: Element, callback: () => void) {
    this.elements.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
    this.observer.unobserve(element);
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const callback = this.elements.get(entry.target);
        if (callback) {
          callback();
          this.unobserve(entry.target);
        }
      }
    });
  }

  disconnect() {
    this.observer.disconnect();
    this.elements.clear();
  }
}
```

#### Resource Hints Manager
```typescript
// src/utils/resource-hints.ts
export class ResourceHintsManager {
  private static hintsAdded = new Set<string>();

  static addDNSPrefetch(domain: string) {
    this.addResourceHint('dns-prefetch', domain);
  }

  static addPreconnect(domain: string) {
    this.addResourceHint('preconnect', domain);
  }

  static addPreload(href: string, as: string) {
    this.addResourceHint('preload', href, as);
  }

  private static addResourceHint(rel: string, href: string, as?: string) {
    const key = `${rel}-${href}`;
    if (this.hintsAdded.has(key)) return;

    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (as) link.setAttribute('as', as);

    document.head.appendChild(link);
    this.hintsAdded.add(key);
  }

  static setupVimeoResourceHints() {
    this.addDNSPrefetch('https://vimeo.com');
    this.addDNSPrefetch('https://i.vimeocdn.com');
    this.addPreconnect('https://player.vimeo.com');
  }
}
```

### 2.4 Accessibility Implementation

```typescript
// src/utils/accessibility.ts
export class AccessibilityManager {
  static setupKeyboardNavigation(element: HTMLElement, callback: () => void) {
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
      }
    });
  }

  static setAriaLabel(element: HTMLElement, label: string) {
    element.setAttribute('aria-label', label);
  }

  static announceToScreenReader(message: string) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = message;

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}
```

## Error Handling & Resilience

### Error Types & Recovery Strategies
```typescript
// src/errors/vimeo-errors.ts
export abstract class VimeoError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
}

export class VimeoAPIError extends VimeoError {
  readonly code = 'API_ERROR';
  readonly recoverable = true;

  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'VimeoAPIError';
  }
}

export class VideoNotFoundError extends VimeoError {
  readonly code = 'VIDEO_NOT_FOUND';
  readonly recoverable = false;

  constructor(videoId: string) {
    super(`Video not found: ${videoId}`);
    this.name = 'VideoNotFoundError';
  }
}

export class PrivacyHashInvalidError extends VimeoError {
  readonly code = 'INVALID_PRIVACY_HASH';
  readonly recoverable = false;

  constructor(hash: string) {
    super(`Invalid privacy hash: ${hash}`);
    this.name = 'PrivacyHashInvalidError';
  }
}

// Error recovery strategies
export class ErrorRecoveryManager {
  static async handleError(error: VimeoError, context: any): Promise<any> {
    if (!error.recoverable) {
      throw error;
    }

    switch (error.code) {
      case 'API_ERROR':
        return this.handleAPIError(error as VimeoAPIError, context);
      default:
        throw error;
    }
  }

  private static async handleAPIError(error: VimeoAPIError, context: any) {
    // Implement retry logic, fallback APIs, etc.
    if (error.statusCode === 404) {
      // Try alternative API
      return this.tryFallbackAPI(context);
    }

    throw error;
  }

  private static async tryFallbackAPI(context: any) {
    // Implementation of fallback strategy
  }
}
```

## Performance Monitoring

### Metrics Collection
```typescript
// src/utils/performance-monitor.ts
export interface PerformanceMetrics {
  loadTime: number;
  apiResponseTime: number;
  thumbnailLoadTime: number;
  componentRenderTime: number;
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTime = performance.now();

  markAPIStart() {
    this.metrics.apiResponseTime = performance.now();
  }

  markAPIEnd() {
    if (this.metrics.apiResponseTime) {
      this.metrics.apiResponseTime = performance.now() - this.metrics.apiResponseTime;
    }
  }

  markComponentReady() {
    this.metrics.loadTime = performance.now() - this.startTime;
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  reportMetrics(videoId: string) {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      // Google Analytics reporting
      (window as any).gtag('event', 'lite_vimeo_performance', {
        video_id: videoId,
        load_time: this.metrics.loadTime,
        api_response_time: this.metrics.apiResponseTime
      });
    }
  }
}
```

## Security Considerations

### Input Sanitization
```typescript
// src/utils/security.ts
export class SecurityManager {
  private static readonly SAFE_URL_PATTERN = /^https:\/\/(vimeo\.com|player\.vimeo\.com)/;

  static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url);
      if (!this.SAFE_URL_PATTERN.test(parsed.origin + parsed.pathname)) {
        throw new Error('Invalid URL origin');
      }
      return parsed.href;
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  static sanitizeVideoId(videoId: string): string {
    const sanitized = videoId.replace(/\D/g, '');
    if (sanitized.length === 0 || sanitized.length > 12) {
      throw new Error('Invalid video ID format');
    }
    return sanitized;
  }

  static sanitizePrivacyHash(hash: string): string {
    const sanitized = hash.replace(/[^a-f0-9]/gi, '').toLowerCase();
    if (sanitized.length !== 12) {
      throw new Error('Invalid privacy hash format');
    }
    return sanitized;
  }
}
```

### CSP Compliance
```typescript
// src/utils/csp-compliance.ts
export class CSPCompliance {
  static createSecureIframe(src: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');

    // Set secure attributes
    iframe.src = src;
    iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.loading = 'lazy';

    // Security headers
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

    return iframe;
  }

  static validateCSPCompliance(): boolean {
    // Check if current CSP allows Vimeo domains
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
      const csp = metaCSP.getAttribute('content') || '';
      return csp.includes('vimeo.com') || csp.includes('*.vimeo.com');
    }
    return true; // Assume compliance if no CSP found
  }
}
```

## Build & Distribution

### Bundle Configuration
```typescript
// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/lite-vimeo-embed.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      typescript(),
      visualizer({ filename: 'dist/bundle-analysis.html' })
    ]
  },
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/lite-vimeo-embed.umd.js',
      format: 'umd',
      name: 'LiteVimeoEmbed',
      sourcemap: true
    },
    plugins: [typescript(), terser()]
  },
  // IIFE build for CDN
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/lite-vimeo-embed.min.js',
      format: 'iife',
      name: 'LiteVimeoEmbed',
      sourcemap: true
    },
    plugins: [typescript(), terser()]
  }
];
```

## Deployment & Release Strategy

### Automated Release Pipeline
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  test-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Build package
        run: npm run build

      - name: Size check
        run: npm run size-check

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npm run semantic-release
```

This technical specification provides the detailed implementation guidance needed for each phase of the modernization project. Each section includes concrete code examples, architectural patterns, and implementation strategies that can be directly translated into working code.

---

**Document Status**: Implementation Ready
**Last Updated**: 2024-12-19
**Dependencies**: PRD-2025-Modernization.md, Implementation-Roadmap.md
**Next Steps**: Begin Phase 1 implementation