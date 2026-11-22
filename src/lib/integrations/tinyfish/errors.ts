/**
 * AgriDOST 4.0: Typed Error Hierarchy for TinyFish AI Integration
 */

export class TinyFishError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly isOperational: boolean;

  constructor(message: string, code: string = 'TINYFISH_ERROR', status?: number) {
    super(message);
    this.name = 'TinyFishError';
    this.code = code;
    this.status = status;
    this.isOperational = true;
  }
}

export class TinyFishAuthError extends TinyFishError {
  constructor(message: string = 'TinyFish API authentication failed. Invalid or missing TINYFISH_API_KEY.') {
    super(message, 'TINYFISH_AUTH_ERROR', 401);
    this.name = 'TinyFishAuthError';
  }
}

export class TinyFishRateLimitError extends TinyFishError {
  public readonly retryAfterMs?: number;

  constructor(message: string = 'TinyFish API rate limit exceeded.', retryAfterMs?: number) {
    super(message, 'TINYFISH_RATE_LIMIT', 429);
    this.name = 'TinyFishRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class TinyFishTimeoutError extends TinyFishError {
  constructor(message: string = 'TinyFish request timed out.') {
    super(message, 'TINYFISH_TIMEOUT', 504);
    this.name = 'TinyFishTimeoutError';
  }
}

export class TinyFishSSRFError extends TinyFishError {
  constructor(message: string = 'Requested URL failed security validation (SSRF protection).') {
    super(message, 'TINYFISH_SSRF_VIOLATION', 400);
    this.name = 'TinyFishSSRFError';
  }
}

export class TinyFishAPIError extends TinyFishError {
  constructor(message: string, status: number = 500) {
    super(message, 'TINYFISH_API_ERROR', status);
    this.name = 'TinyFishAPIError';
  }
}
