/**
 * AgriDOST 4.0: Google Maps JavaScript API Dynamic Script Loader
 *
 * Implements a robust singleton script loader pattern:
 * - Dynamically loads Google Maps JavaScript API with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * - Strictly prevents duplicate script tag injections
 * - Handles authentication failures (window.gm_authFailure), network errors, and timeouts
 * - Provides clean reset hook for automated testing
 */

import { GoogleMapsLoaderOptions } from '@/types/maps';

const SCRIPT_ID = 'google-maps-js-api-agridost';
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api/js';
const DEFAULT_TIMEOUT_MS = 10000;

// Singleton promise tracking active or completed loading
let loaderPromise: Promise<unknown> | null = null;
let authFailureDetected = false;

/**
 * Checks whether an API key conforms to basic Google Maps API Key structure.
 * Keys typically start with 'AIza' and are ~39 characters long.
 */
export function isValidGoogleMapsKeyFormat(key: string | null | undefined): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 15) return false;
  if (
    trimmed === 'YOUR_GOOGLE_MAPS_API_KEY' ||
    trimmed === 'your_google_maps_api_key' ||
    trimmed === 'PLACEHOLDER_KEY' ||
    trimmed === 'demo_key'
  ) {
    return false;
  }
  return true;
}

/**
 * Retrieves the effective Google Maps API key from options or environment.
 */
export function getGoogleMapsApiKey(customKey?: string): string | null {
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  const envKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    (typeof window !== 'undefined'
      ? (window as unknown as { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string }).NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      : null);

  if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return null;
}

/**
 * Returns true if a valid, non-placeholder Google Maps API key is configured.
 */
export function hasValidGoogleMapsKey(customKey?: string): boolean {
  const key = getGoogleMapsApiKey(customKey);
  return isValidGoogleMapsKeyFormat(key);
}

/**
 * Returns true if Google Maps JavaScript API is already loaded and available on window.
 */
export function isGoogleMapsLoaded(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { google?: { maps?: unknown } };
  return Boolean(win.google && win.google.maps);
}

/**
 * Resets the loader singleton state. Essential for automated testing and retry logic.
 */
export function resetGoogleMapsLoaderForTesting(): void {
  loaderPromise = null;
  authFailureDetected = false;
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }
}

/**
 * Dynamically loads the Google Maps JavaScript API using a singleton pattern.
 * Resolves with the `google.maps` namespace or rejects with a descriptive error.
 */
export function loadGoogleMapsScript(options: GoogleMapsLoaderOptions = {}): Promise<unknown> {
  // 1. SSR check
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps JS API can only be loaded in a browser environment.'));
  }

  // 2. Return cached instance if already available
  const win = window as unknown as {
    google?: { maps?: unknown };
    gm_authFailure?: () => void;
  };

  if (win.google && win.google.maps) {
    return Promise.resolve(win.google.maps);
  }

  // 3. Return existing in-flight loader promise (Singleton)
  if (loaderPromise) {
    return loaderPromise;
  }

  // 4. Resolve API key
  const apiKey = getGoogleMapsApiKey(options.apiKey);
  if (!apiKey || !isValidGoogleMapsKeyFormat(apiKey)) {
    return Promise.reject(
      new Error(
        'Google Maps API key is missing or invalid. Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment.'
      )
    );
  }

  loaderPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      const existing = document.querySelector(
        `script[src*="maps.googleapis.com/maps/api/js"]`
      ) as HTMLScriptElement | null;
      if (existing) {
        script = existing;
      }
    }

    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    // Global Google Maps authentication failure hook
    const prevAuthFailure = win.gm_authFailure;
    win.gm_authFailure = () => {
      authFailureDetected = true;
      cleanup();
      loaderPromise = null;
      if (typeof prevAuthFailure === 'function') {
        try {
          prevAuthFailure();
        } catch {
          // ignore
        }
      }
      reject(
        new Error(
          'Google Maps Authentication Failure (gm_authFailure). The provided API key is unauthorized, invalid, or billing is disabled.'
        )
      );
    };

    // Timeout guard
    timeoutTimer = setTimeout(() => {
      cleanup();
      loaderPromise = null;
      reject(
        new Error(
          `Google Maps JS API load timed out after ${timeoutMs}ms. Possible network failure, offline status, or ad-blocker.`
        )
      );
    }, timeoutMs);

    const onLoadSuccess = () => {
      cleanup();
      if (authFailureDetected) {
        loaderPromise = null;
        reject(new Error('Google Maps authentication failed during script execution.'));
        return;
      }
      if (win.google && win.google.maps) {
        resolve(win.google.maps);
      } else {
        loaderPromise = null;
        reject(new Error('Google Maps script loaded, but window.google.maps was not initialized.'));
      }
    };

    const onLoadError = (err: Event | string) => {
      cleanup();
      loaderPromise = null;
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      reject(
        new Error(
          `Failed to load Google Maps script from Google CDN: ${
            typeof err === 'string' ? err : 'Network or CSP connection blocked.'
          }`
        )
      );
    };

    if (script) {
      // Script tag exists, hook into its load/error
      script.addEventListener('load', onLoadSuccess, { once: true });
      script.addEventListener('error', onLoadError, { once: true });
      return;
    }

    // Build URL with parameters
    const libraries = (options.libraries || ['geometry', 'places']).join(',');
    const version = options.version || 'weekly';
    const language = options.language || 'en';
    const region = options.region || 'IN';

    const params = new URLSearchParams({
      key: apiKey,
      v: version,
      libraries,
      language,
      region,
      loading: 'async',
    });

    const scriptUrl = `${GOOGLE_MAPS_BASE_URL}?${params.toString()}`;

    // Create and inject script tag
    script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'text/javascript';
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', onLoadSuccess, { once: true });
    script.addEventListener('error', onLoadError, { once: true });

    const targetHead = document.head || document.getElementsByTagName('head')[0] || document.body;
    targetHead.appendChild(script);
  });

  return loaderPromise;
}
