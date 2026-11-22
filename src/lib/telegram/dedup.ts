/**
 * AgriDOST 4.0: Notification Deduplication & Idempotency Engine
 *
 * Prevents alert spam and duplicate dispatches to farmers across
 * a 24-hour sliding window.
 */

import { TelegramNotification } from '@/types/telegram';

export const DEFAULT_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DedupRecord {
  timestamp: number;
  key: string;
}

class DedupManager {
  private cache: Map<string, number> = new Map();

  /**
   * Cleanup expired entries outside the sliding window.
   */
  private prune(windowMs: number) {
    const now = Date.now();
    for (const [key, timestamp] of this.cache.entries()) {
      if (now - timestamp > windowMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if the key has already been delivered within the window.
   */
  public isDuplicate(key: string, windowMs: number = DEFAULT_DEDUP_WINDOW_MS): boolean {
    this.prune(windowMs);
    const existing = this.cache.get(key);
    if (!existing) return false;
    return Date.now() - existing < windowMs;
  }

  /**
   * Record that a notification with the given key was delivered.
   */
  public recordDelivery(key: string, timestamp: number = Date.now()): void {
    this.cache.set(key, timestamp);
  }

  /**
   * Atomically check if duplicate, and if not, record it.
   */
  public checkAndRecord(
    key: string,
    windowMs: number = DEFAULT_DEDUP_WINDOW_MS
  ): { isDuplicate: boolean; recorded: boolean } {
    if (this.isDuplicate(key, windowMs)) {
      return { isDuplicate: true, recorded: false };
    }
    this.recordDelivery(key);
    return { isDuplicate: false, recorded: true };
  }

  /**
   * Clear all deduplication entries (used in testing).
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Return stats for diagnostics.
   */
  public getStats(windowMs: number = DEFAULT_DEDUP_WINDOW_MS): {
    totalTracked: number;
    activeWindowMs: number;
  } {
    this.prune(windowMs);
    return {
      totalTracked: this.cache.size,
      activeWindowMs: windowMs,
    };
  }
}

const globalDedupManager = new DedupManager();

/**
 * Generate a deterministic deduplication key for a notification.
 * Uses farmerId, category, and a content-based or id-based signature.
 */
export function getNotificationDedupKey(notification: TelegramNotification): string {
  // If specific ID is provided, use it
  if (notification.id && !notification.id.startsWith('temp-')) {
    return `dedup:${notification.farmerId}:${notification.category}:${notification.id}`;
  }

  // Content-based hash fallback
  const content = `${notification.titleEn}_${notification.bodyEn}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `dedup:${notification.farmerId}:${notification.category}:${content.slice(0, 48)}`;
}

export function isDuplicate(
  key: string,
  windowMs: number = DEFAULT_DEDUP_WINDOW_MS
): boolean {
  return globalDedupManager.isDuplicate(key, windowMs);
}

export function recordDelivery(
  key: string,
  timestamp: number = Date.now()
): void {
  globalDedupManager.recordDelivery(key, timestamp);
}

export function checkAndRecord(
  key: string,
  windowMs: number = DEFAULT_DEDUP_WINDOW_MS
): { isDuplicate: boolean; recorded: boolean } {
  return globalDedupManager.checkAndRecord(key, windowMs);
}

export function clearDedupCache(): void {
  globalDedupManager.clear();
}

export function getDedupStats(
  windowMs: number = DEFAULT_DEDUP_WINDOW_MS
): { totalTracked: number; activeWindowMs: number } {
  return globalDedupManager.getStats(windowMs);
}
