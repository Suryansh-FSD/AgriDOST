/**
 * AgriDOST 4.0: Agricultural Web Research Persistence Layer
 * Integrates with Supabase `agricultural_web_research` table with safe
 * in-memory and LocalStorage fallbacks.
 */

import { AgriculturalWebResearchRecord } from './types';
import {
  getSupabaseConfigStatus,
  getSupabaseRestUrl,
  getSupabaseHeaders,
} from '@/lib/supabase/client';

class ResearchMemoryStore {
  private records: Map<string, AgriculturalWebResearchRecord> = new Map();

  public save(record: AgriculturalWebResearchRecord): void {
    this.records.set(record.id, record);
    // If running in browser environment, sync to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const existing = JSON.parse(window.localStorage.getItem('agridost_web_research_v1') || '[]');
        const filtered = existing.filter((r: AgriculturalWebResearchRecord) => r.id !== record.id);
        filtered.unshift(record);
        window.localStorage.setItem('agridost_web_research_v1', JSON.stringify(filtered.slice(0, 100)));
      } catch {
        // ignore local storage quota issues
      }
    }
  }

  public query(queryText: string, category?: string): AgriculturalWebResearchRecord[] {
    const q = queryText.toLowerCase().trim();
    const results: AgriculturalWebResearchRecord[] = [];

    // Check localStorage first if in browser
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = JSON.parse(window.localStorage.getItem('agridost_web_research_v1') || '[]');
        for (const item of stored) {
          if (!this.records.has(item.id)) {
            this.records.set(item.id, item);
          }
        }
      } catch {
        // ignore
      }
    }

    for (const record of this.records.values()) {
      if (category && record.category !== category) continue;
      if (record.query.toLowerCase().includes(q) || record.extracted_summary.toLowerCase().includes(q)) {
        results.push(record);
      }
    }

    return results.sort((a, b) => new Date(b.retrieved_at).getTime() - new Date(a.retrieved_at).getTime());
  }

  public clear(): void {
    this.records.clear();
  }
}

export const globalResearchStore = new ResearchMemoryStore();

/**
 * Persists an agricultural research item to Supabase or local fallback.
 */
export async function persistResearchRecord(
  data: Omit<AgriculturalWebResearchRecord, 'id' | 'created_at' | 'updated_at'>,
  options?: {
    overrides?: { url?: string; anonKey?: string };
    authToken?: string;
  }
): Promise<{ success: boolean; record: AgriculturalWebResearchRecord; isOffline: boolean; error?: string }> {
  const recordId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const record: AgriculturalWebResearchRecord = {
    ...data,
    id: recordId,
    created_at: now,
    updated_at: now,
  };

  // Always store locally
  globalResearchStore.save(record);

  const status = getSupabaseConfigStatus(options?.overrides);
  if (!status.isConfigured) {
    return {
      success: true,
      isOffline: true,
      record,
    };
  }

  try {
    const endpoint = getSupabaseRestUrl('agricultural_web_research', options?.overrides);
    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
      prefer: 'return=minimal',
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: record.id,
        query: record.query,
        category: record.category,
        provider: record.provider,
        source_url: record.source_url,
        source_name: record.source_name,
        source_type: record.source_type,
        is_official: record.is_official,
        extracted_summary: record.extracted_summary,
        structured_data: record.structured_data,
        retrieved_at: record.retrieved_at,
        expires_at: record.expires_at,
        status: record.status,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        isOffline: true,
        error: `Supabase table returned HTTP ${res.status}: ${errText}`,
        record,
      };
    }

    return {
      success: true,
      isOffline: false,
      record,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      isOffline: true,
      error: msg,
      record,
    };
  }
}

/**
 * Queries persisted research records from Supabase with local fallback.
 */
export async function queryPersistedResearchRecords(
  queryText: string,
  category?: string,
  options?: {
    overrides?: { url?: string; anonKey?: string };
    authToken?: string;
  }
): Promise<AgriculturalWebResearchRecord[]> {
  const status = getSupabaseConfigStatus(options?.overrides);

  if (!status.isConfigured) {
    return globalResearchStore.query(queryText, category);
  }

  try {
    let url = `${getSupabaseRestUrl('agricultural_web_research', options?.overrides)}?status=eq.active&order=retrieved_at.desc&limit=20`;
    if (category) {
      url += `&category=eq.${encodeURIComponent(category)}`;
    }

    const headers = getSupabaseHeaders({
      authToken: options?.authToken,
      anonKey: options?.overrides?.anonKey,
    });

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      return globalResearchStore.query(queryText, category);
    }

    const data = (await res.json()) as AgriculturalWebResearchRecord[];
    // Populate local cache
    for (const item of data) {
      globalResearchStore.save(item);
    }
    return data;
  } catch {
    return globalResearchStore.query(queryText, category);
  }
}
