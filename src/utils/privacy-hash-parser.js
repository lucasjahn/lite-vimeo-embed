/**
 * Privacy Hash Parser
 * Handles detection and extraction of Vimeo privacy hashes from various URL formats
 * and component attributes to support private/unlisted video embeds.
 */

/**
 * Privacy pattern definitions for different Vimeo URL formats
 */
const PRIVACY_PATTERNS = [
  {
    // https://vimeo.com/123456789/abc123def456
    pattern: /vimeo\.com\/(\d+)\/([a-f0-9]{8,12})/i,
    extractor: (match) => ({
      videoId: match[1],
      privacyHash: match[2]
    })
  },
  {
    // https://player.vimeo.com/video/123456789?h=abc123def456
    pattern: /player\.vimeo\.com\/video\/(\d+).*[?&]h=([a-f0-9]{8,12})/i,
    extractor: (match) => ({
      videoId: match[1],
      privacyHash: match[2]
    })
  }
];

/**
 * Regular expressions for validation
 */
const VIDEO_ID_PATTERN = /^\d{1,12}$/;
const PRIVACY_HASH_PATTERN = /^[a-f0-9]{8,12}$/i;

/**
 * Parse video identifier from various input formats
 * @param {string} input - Video URL, video ID, or other input
 * @param {string} [privacyHashAttr] - Privacy hash from attribute
 * @returns {Object} Parsed video identifier with videoId, privacyHash, and isPrivate
 */
export function parseVideoIdentifier(input, privacyHashAttr) {
  if (!input) {
    throw new Error('Video input is required');
  }

  const sanitizedInput = sanitizeInput(input);

  // Try URL patterns first
  for (const { pattern, extractor } of PRIVACY_PATTERNS) {
    const match = sanitizedInput.match(pattern);
    if (match) {
      const { videoId, privacyHash } = extractor(match);

      if (!validateVideoId(videoId)) {
        throw new Error(`Invalid video ID extracted from URL: ${videoId}`);
      }

      if (!validatePrivacyHash(privacyHash)) {
        throw new Error(`Invalid privacy hash extracted from URL: ${privacyHash}`);
      }

      return {
        videoId,
        privacyHash,
        isPrivate: true
      };
    }
  }

  // Extract video ID from plain input (could be just the ID or a simple URL)
  const videoId = extractVideoId(sanitizedInput);

  if (!validateVideoId(videoId)) {
    throw new Error(`Invalid video ID format: ${videoId}`);
  }

  // Check if privacy hash is provided as attribute
  if (privacyHashAttr) {
    const sanitizedHash = sanitizeInput(privacyHashAttr);

    if (!validatePrivacyHash(sanitizedHash)) {
      throw new Error(`Invalid privacy hash format: ${sanitizedHash}`);
    }

    return {
      videoId,
      privacyHash: sanitizedHash,
      isPrivate: true
    };
  }

  // Public video
  return {
    videoId,
    isPrivate: false
  };
}

/**
 * Extract video ID from various input formats
 * @param {string} input - Input string
 * @returns {string} Extracted video ID
 */
function extractVideoId(input) {
  // Try to extract from common Vimeo URL patterns
  const urlPatterns = [
    /vimeo\.com\/(\d+)/i,
    /player\.vimeo\.com\/video\/(\d+)/i
  ];

  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // If no URL pattern matches, assume input is the video ID itself
  return input;
}

/**
 * Validate video ID format
 * @param {string} videoId - Video ID to validate
 * @returns {boolean} True if valid
 */
export function validateVideoId(videoId) {
  return VIDEO_ID_PATTERN.test(videoId);
}

/**
 * Validate privacy hash format
 * @param {string} hash - Privacy hash to validate
 * @returns {boolean} True if valid
 */
export function validatePrivacyHash(hash) {
  return PRIVACY_HASH_PATTERN.test(hash);
}

/**
 * Sanitize input to prevent malicious content
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  return input
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .trim();
}

/**
 * Check if a video identifier represents a private video
 * @param {Object} identifier - Video identifier object
 * @returns {boolean} True if private
 */
export function isPrivateVideo(identifier) {
  return identifier && identifier.isPrivate === true && identifier.privacyHash;
}

/**
 * Create a clean video URL for API calls
 * @param {Object} identifier - Video identifier
 * @returns {string} Clean video URL
 */
export function createVideoUrl(identifier) {
  if (isPrivateVideo(identifier)) {
    return `https://vimeo.com/${identifier.videoId}/${identifier.privacyHash}`;
  }
  return `https://vimeo.com/${identifier.videoId}`;
}

/**
 * Create iframe URL with proper parameters
 * @param {Object} identifier - Video identifier
 * @param {string} [params] - Additional URL parameters
 * @returns {string} Complete iframe URL
 */
export function createIframeUrl(identifier, params = '') {
  const urlParams = new URLSearchParams(params);

  // Add privacy hash if present
  if (isPrivateVideo(identifier)) {
    urlParams.set('h', identifier.privacyHash);
  }

  // Set default autoplay
  if (!urlParams.has('autoplay')) {
    urlParams.set('autoplay', '1');
  }

  const paramString = urlParams.toString();
  return `https://player.vimeo.com/video/${identifier.videoId}${paramString ? '?' + paramString : ''}`;
}