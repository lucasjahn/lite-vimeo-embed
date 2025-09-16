/**
 * Error Handling Utilities
 * Provides comprehensive error management for lite-vimeo-embed
 * with recovery strategies and detailed logging.
 */

/**
 * Custom error classes for different failure scenarios
 */
export class LiteVimeoError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', originalError = null) {
    super(message);
    this.name = 'LiteVimeoError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.recoverable = this.isRecoverable();
  }

  isRecoverable() {
    const recoverableCodes = [
      'API_TIMEOUT',
      'NETWORK_ERROR',
      'TEMPORARY_ERROR',
      'RATE_LIMITED'
    ];
    return recoverableCodes.includes(this.code);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }
}

export class VideoParsingError extends LiteVimeoError {
  constructor(message, input = null) {
    super(message, 'PARSING_ERROR');
    this.input = input;
    this.recoverable = false;
  }
}

export class VideoValidationError extends LiteVimeoError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
    this.recoverable = false;
  }
}

export class APIError extends LiteVimeoError {
  constructor(message, statusCode = null, endpoint = null, originalError = null) {
    const code = APIError.getCodeFromStatus(statusCode);
    super(message, code, originalError);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }

  static getCodeFromStatus(statusCode) {
    const statusCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'RATE_LIMITED',
      500: 'SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
      408: 'REQUEST_TIMEOUT'
    };

    return statusCodes[statusCode] || 'API_ERROR';
  }

  isRecoverable() {
    const recoverableStatuses = [408, 429, 500, 502, 503, 504];
    return recoverableStatuses.includes(this.statusCode);
  }
}

/**
 * Error Recovery Manager
 * Implements various strategies for recovering from errors
 */
export class ErrorRecoveryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableFallbacks = options.enableFallbacks !== false;
    this.logErrors = options.logErrors !== false;
  }

  /**
   * Handle error with appropriate recovery strategy
   * @param {Error} error - The error to handle
   * @param {Object} context - Context information for recovery
   * @param {number} attempt - Current attempt number
   * @returns {Promise<any>} Recovery result or throws error
   */
  async handleError(error, context = {}, attempt = 1) {
    if (this.logErrors) {
      this.logError(error, context, attempt);
    }

    // If it's not a recoverable error, throw immediately
    if (!(error instanceof LiteVimeoError) || !error.recoverable) {
      throw error;
    }

    // If we've exceeded max retries, throw the error
    if (attempt > this.maxRetries) {
      throw new LiteVimeoError(
        `Max retries exceeded (${this.maxRetries}): ${error.message}`,
        'MAX_RETRIES_EXCEEDED',
        error
      );
    }

    // Apply recovery strategy based on error type
    try {
      return await this.applyRecoveryStrategy(error, context, attempt);
    } catch (recoveryError) {
      // If recovery fails, try again with incremented attempt
      await this.delay(this.retryDelay * attempt);
      return this.handleError(error, context, attempt + 1);
    }
  }

  /**
   * Apply appropriate recovery strategy based on error type
   */
  async applyRecoveryStrategy(error, context, attempt) {
    switch (error.code) {
      case 'API_TIMEOUT':
      case 'NETWORK_ERROR':
        return this.retryWithDelay(context.retryFunction, attempt);

      case 'RATE_LIMITED':
        return this.retryWithBackoff(context.retryFunction, attempt);

      case 'NOT_FOUND':
        return this.tryAlternativeAPI(context);

      case 'SERVER_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return this.tryFallbackStrategy(context);

      default:
        throw error;
    }
  }

  /**
   * Retry with simple delay
   */
  async retryWithDelay(retryFunction, attempt) {
    if (!retryFunction) {
      throw new LiteVimeoError('No retry function provided', 'NO_RETRY_FUNCTION');
    }

    await this.delay(this.retryDelay * attempt);
    return retryFunction();
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(retryFunction, attempt) {
    if (!retryFunction) {
      throw new LiteVimeoError('No retry function provided', 'NO_RETRY_FUNCTION');
    }

    const backoffDelay = Math.min(this.retryDelay * Math.pow(2, attempt - 1), 10000);
    await this.delay(backoffDelay);
    return retryFunction();
  }

  /**
   * Try alternative API strategy
   */
  async tryAlternativeAPI(context) {
    if (!context.alternativeFunction) {
      throw new LiteVimeoError('No alternative API available', 'NO_ALTERNATIVE_API');
    }

    console.info('Trying alternative API strategy...');
    return context.alternativeFunction();
  }

  /**
   * Try fallback strategy (e.g., direct iframe)
   */
  async tryFallbackStrategy(context) {
    if (!this.enableFallbacks || !context.fallbackFunction) {
      throw new LiteVimeoError('No fallback strategy available', 'NO_FALLBACK');
    }

    console.info('Applying fallback strategy...');
    return context.fallbackFunction();
  }

  /**
   * Delay helper
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with context
   */
  logError(error, context, attempt) {
    const logData = {
      error: error.toJSON ? error.toJSON() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: {
        videoId: context.videoId || 'unknown',
        isPrivate: context.isPrivate || false,
        endpoint: context.endpoint || 'unknown',
        attempt: attempt
      }
    };

    if (attempt === 1) {
      console.warn('LiteVimeo Error:', logData);
    } else {
      console.warn(`LiteVimeo Retry ${attempt}:`, logData);
    }
  }
}

/**
 * Default error recovery manager instance
 */
export const defaultErrorRecovery = new ErrorRecoveryManager({
  maxRetries: 3,
  retryDelay: 1000,
  enableFallbacks: true,
  logErrors: true
});

/**
 * Helper functions for common error scenarios
 */
export function createParsingError(message, input) {
  return new VideoParsingError(message, input);
}

export function createValidationError(message, field, value) {
  return new VideoValidationError(message, field, value);
}

export function createAPIError(message, statusCode, endpoint, originalError) {
  return new APIError(message, statusCode, endpoint, originalError);
}

/**
 * Error boundary for component initialization
 */
export async function withErrorBoundary(asyncFunction, context = {}) {
  try {
    return await asyncFunction();
  } catch (error) {
    // Enhance error with context if it's not already a LiteVimeoError
    if (!(error instanceof LiteVimeoError)) {
      const enhancedError = new LiteVimeoError(
        error.message,
        'COMPONENT_ERROR',
        error
      );
      throw enhancedError;
    }
    throw error;
  }
}

/**
 * Graceful degradation helper
 * Returns a fallback value when operations fail
 */
export async function withFallback(primaryFunction, fallbackFunction, context = {}) {
  try {
    return await primaryFunction();
  } catch (error) {
    if (fallbackFunction && (!(error instanceof LiteVimeoError) || error.recoverable)) {
      console.info('Primary function failed, using fallback:', error.message);
      try {
        return await fallbackFunction();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError.message);
        throw error; // Throw original error
      }
    }
    throw error;
  }
}