/**
 * Vimeo API Client
 * Handles communication with Vimeo's APIs (V2 and oEmbed) to fetch video metadata
 * with support for both public and private videos.
 */

import { isPrivateVideo, createVideoUrl } from '../utils/privacy-hash-parser.js';

/**
 * Custom error class for Vimeo API errors
 */
export class VimeoAPIError extends Error {
  constructor(message, statusCode = null, originalError = null) {
    super(message);
    this.name = 'VimeoAPIError';
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.recoverable = statusCode !== 403 && statusCode !== 404; // Some errors are recoverable
  }
}

/**
 * Abstract base class for Vimeo API clients
 */
class VimeoAPIClient {
  constructor(timeout = 10000) {
    this.timeout = timeout;
  }

  /**
   * Fetch video metadata using the appropriate API
   * @param {Object} identifier - Video identifier with videoId, privacyHash, isPrivate
   * @returns {Promise<Object>} Normalized video metadata
   */
  async fetchMetadata(identifier) {
    try {
      const rawResponse = await this.fetchRaw(identifier);
      return this.parseResponse(rawResponse, identifier);
    } catch (error) {
      if (error instanceof VimeoAPIError) {
        throw error;
      }
      throw new VimeoAPIError(`Failed to fetch video metadata: ${error.message}`, null, error);
    }
  }

  /**
   * Make HTTP request with timeout
   * @param {string} url - URL to fetch
   * @returns {Promise<Response>} Response object
   */
  async fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'lite-vimeo-embed/0.3.0'
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new VimeoAPIError('Request timeout', 408, error);
      }
      throw error;
    }
  }

  /**
   * Abstract method to fetch raw data from API
   * @param {Object} identifier - Video identifier
   * @returns {Promise<any>} Raw API response
   */
  async fetchRaw(identifier) {
    throw new Error('fetchRaw must be implemented by subclass');
  }

  /**
   * Abstract method to parse API response
   * @param {any} response - Raw API response
   * @param {Object} identifier - Video identifier
   * @returns {Object} Normalized metadata
   */
  parseResponse(response, identifier) {
    throw new Error('parseResponse must be implemented by subclass');
  }
}

/**
 * Vimeo API v2 client for public videos
 */
export class VimeoV2APIClient extends VimeoAPIClient {
  constructor(timeout) {
    super(timeout);
    this.endpoint = 'https://vimeo.com/api/v2/video';
  }

  async fetchRaw(identifier) {
    if (isPrivateVideo(identifier)) {
      throw new VimeoAPIError('V2 API does not support private videos', 400);
    }

    const url = `${this.endpoint}/${identifier.videoId}.json`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new VimeoAPIError(`Video not found: ${identifier.videoId}`, response.status);
      }
      throw new VimeoAPIError(
        `V2 API request failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new VimeoAPIError('Invalid V2 API response format', 500);
    }

    return data[0];
  }

  parseResponse(response, identifier) {
    if (!response || typeof response !== 'object') {
      throw new VimeoAPIError('Invalid V2 response data');
    }

    return {
      videoId: response.id?.toString() || identifier.videoId,
      title: response.title || 'Untitled Video',
      description: response.description || '',
      thumbnailUrl: response.thumbnail_large || '',
      width: response.width || 640,
      height: response.height || 360,
      duration: response.duration || 0,
      authorName: response.user_name || '',
      uploadDate: response.upload_date || null,
      url: response.url || `https://vimeo.com/${identifier.videoId}`
    };
  }
}

/**
 * Vimeo oEmbed API client for private and public videos
 */
export class VimeoOEmbedAPIClient extends VimeoAPIClient {
  constructor(timeout) {
    super(timeout);
    this.endpoint = 'https://vimeo.com/api/oembed.json';
  }

  async fetchRaw(identifier) {
    const videoUrl = createVideoUrl(identifier);

    // Request higher resolution thumbnail by specifying width/height
    // Default oEmbed gives 480x360, we request larger for better quality
    const params = new URLSearchParams({
      url: videoUrl,
      width: 1280,  // Request HD width for better thumbnail quality
      height: 720   // Request HD height for better thumbnail quality
    });

    const oembedUrl = `${this.endpoint}?${params.toString()}`;

    const response = await this.fetchWithTimeout(oembedUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new VimeoAPIError(
          `Video not found or privacy hash invalid: ${identifier.videoId}`,
          response.status
        );
      }
      throw new VimeoAPIError(
        `oEmbed API request failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();

    if (!data || typeof data !== 'object') {
      throw new VimeoAPIError('Invalid oEmbed API response format', 500);
    }

    return data;
  }

  parseResponse(response, identifier) {
    if (!response || typeof response !== 'object') {
      throw new VimeoAPIError('Invalid oEmbed response data');
    }

    // Extract video ID from HTML if not available directly
    const videoId = this.extractVideoIdFromHtml(response.html) || identifier.videoId;

    // Extract privacy hash from HTML if not already known
    const privacyHash = identifier.privacyHash || this.extractPrivacyHashFromHtml(response.html);

    return {
      videoId,
      title: response.title || 'Untitled Video',
      description: response.description || '',
      thumbnailUrl: response.thumbnail_url || '',
      width: response.width || 640,
      height: response.height || 360,
      duration: response.duration || 0,
      authorName: response.author_name || '',
      uploadDate: null, // oEmbed doesn't provide upload date
      url: response.author_url || `https://vimeo.com/${videoId}`,
      privacyHash: privacyHash
    };
  }

  /**
   * Extract video ID from oEmbed HTML response
   * @param {string} html - HTML embed code
   * @returns {string|null} Video ID or null
   */
  extractVideoIdFromHtml(html) {
    if (!html) return null;

    const match = html.match(/video\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract privacy hash from oEmbed HTML response
   * @param {string} html - HTML embed code
   * @returns {string|null} Privacy hash or null
   */
  extractPrivacyHashFromHtml(html) {
    if (!html) return null;

    const match = html.match(/[?&]h=([a-f0-9]{12})/i);
    return match ? match[1] : null;
  }
}

/**
 * API Strategy Router - Updated for 2024/2025 Best Practices
 * Uses oEmbed API for ALL videos (Vimeo API v2 is deprecated)
 * Implements fallback strategies for resilience.
 */
export class APIStrategyRouter {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.enableFallback = options.enableFallback !== false;

    // Primary strategy: oEmbed API for all videos (v2 is deprecated)
    this.oembedClient = new VimeoOEmbedAPIClient(this.timeout);

    // Legacy fallback: V2 API (deprecated but kept for extreme fallback cases)
    this.v2Client = new VimeoV2APIClient(this.timeout);
  }

  /**
   * Fetch video metadata using oEmbed API (recommended for all videos)
   * @param {Object} identifier - Video identifier
   * @returns {Promise<Object>} Video metadata
   */
  async fetchVideoMetadata(identifier) {
    try {
      // Use oEmbed API for all videos (2024+ best practice)
      return await this.oembedClient.fetchMetadata(identifier);
    } catch (error) {
      if (!this.enableFallback || !error.recoverable) {
        throw error;
      }

      // Fallback strategy for public videos only (v2 doesn't support private)
      if (!isPrivateVideo(identifier)) {
        try {
          console.warn('oEmbed failed, trying deprecated V2 API as fallback');
          return await this.v2Client.fetchMetadata(identifier);
        } catch (fallbackError) {
          // If V2 fallback fails, throw the original oEmbed error
          console.error('Both oEmbed and V2 fallback failed');
          throw error;
        }
      } else {
        // No fallback for private videos (v2 doesn't support them)
        throw error;
      }
    }
  }

  /**
   * @deprecated - Legacy method for backward compatibility
   * Use fetchVideoMetadata() instead
   */
  async fetchPrivateVideoMetadata(identifier) {
    console.warn('fetchPrivateVideoMetadata is deprecated. Use fetchVideoMetadata() instead.');
    return this.fetchVideoMetadata(identifier);
  }

  /**
   * @deprecated - Legacy method for backward compatibility
   * Use fetchVideoMetadata() instead
   */
  async fetchPublicVideoMetadata(identifier) {
    console.warn('fetchPublicVideoMetadata is deprecated. Use fetchVideoMetadata() instead.');
    return this.fetchVideoMetadata(identifier);
  }
}

/**
 * Create a default API router instance
 * @param {Object} options - Configuration options
 * @returns {APIStrategyRouter} Router instance
 */
export function createAPIRouter(options = {}) {
  return new APIStrategyRouter(options);
}