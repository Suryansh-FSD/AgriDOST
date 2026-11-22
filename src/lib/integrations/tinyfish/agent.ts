/**
 * AgriDOST 4.0: TinyAgent Controlled Web Automation
 * Executes read-only, goal-directed research on public agricultural websites.
 * Enforces strict safety guardrails: blocks form submissions, payment transactions,
 * and account modifications.
 */

import { TinyFishClient, defaultTinyFishClient } from './client';
import { TinyAgentRunOptions, TinyAgentRunResponse } from './types';
import { TinyAgentRequestSchema, TinyAgentResponseSchema } from './schemas';
import { validateSafeUrl, classifySource } from './security';
import { TinyFishError } from './errors';
import { getOfflineAgentResult } from './offline';

// Prohibited active transaction keywords in goals
const PROHIBITED_GOAL_PATTERNS = [
  /\b(submit|apply|fill out application|register account|sign up)\b/i,
  /\b(pay|payment|transfer funds|debit|credit card|upi|checkout)\b/i,
  /\b(change password|delete|update profile|modify account)\b/i,
  /\b(book|order|purchase|buy)\b/i,
];

/**
 * Executes a controlled, read-only browser research goal via TinyAgent.
 */
export async function executeTinyAgent<T = Record<string, unknown>>(
  options: TinyAgentRunOptions,
  client: TinyFishClient = defaultTinyFishClient
): Promise<TinyAgentRunResponse<T> & { isOfficial: boolean; provenance: 'live_api' | 'offline_deterministic' }> {
  const validated = TinyAgentRequestSchema.parse(options);

  // Safety Guardrail 1: SSRF Validation on target URL
  validateSafeUrl(validated.url);

  // Safety Guardrail 2: Enforce Read-Only Research (Prohibit active transactions/submissions)
  for (const pattern of PROHIBITED_GOAL_PATTERNS) {
    if (pattern.test(validated.goal)) {
      throw new TinyFishError(
        `Safety policy violation: TinyAgent is restricted exclusively to read-only research. ` +
        `Autonomous form submission, payments, or account changes are strictly forbidden.`,
        'TINYFISH_SAFETY_POLICY_VIOLATION',
        403
      );
    }
  }

  const sourceMeta = classifySource(validated.url);

  // Offline / Simulated Fallback
  if (!client.isConfigured() || process.env.TINYFISH_SIMULATED_MODE === 'true') {
    const offlineResult = getOfflineAgentResult<T>(validated.url, validated.goal);
    return {
      run_id: `sim-agent-${Date.now()}`,
      status: 'COMPLETED',
      started_at: new Date(Date.now() - 15000).toISOString(),
      finished_at: new Date().toISOString(),
      num_of_steps: 4,
      result: offlineResult,
      error: null,
      isOfficial: sourceMeta.isOfficial,
      provenance: 'offline_deterministic',
    };
  }

  const rawResponse = await client.request<TinyAgentRunResponse<T>>(
    `${client.agentBaseUrl}/v1/automation/run`,
    {
      method: 'POST',
      body: {
        url: validated.url,
        goal: validated.goal,
        max_steps: validated.max_steps,
        browser_profile: validated.browser_profile,
      },
      timeoutMs: options.timeoutMs ?? 60000,
    }
  );

  const parsed = TinyAgentResponseSchema.parse(rawResponse);

  return {
    run_id: parsed.run_id,
    status: parsed.status,
    started_at: parsed.started_at,
    finished_at: parsed.finished_at,
    num_of_steps: parsed.num_of_steps,
    result: parsed.result as T,
    error: parsed.error,
    isOfficial: sourceMeta.isOfficial,
    provenance: 'live_api',
  };
}
