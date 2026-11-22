/**
 * AgriDOST 4.0: Zod Validation Schemas for TinyFish AI Integration
 */

import { z } from 'zod';

export const TinySearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').max(500, 'Query exceeds 500 characters'),
  location: z.string().optional().default('IN'),
  language: z.string().optional().default('en'),
  include_domains: z.array(z.string()).optional(),
  exclude_domains: z.array(z.string()).optional(),
  recency_minutes: z.number().int().positive().optional(),
  after_date: z.string().optional(),
  bypassCache: z.boolean().optional().default(false),
});

export const TinyFetchRequestSchema = z.object({
  urls: z.array(z.string().url('Must be a valid URL')).min(1, 'At least 1 URL required').max(10, 'Maximum 10 URLs per request'),
  format: z.enum(['markdown', 'text', 'html']).optional().default('markdown'),
  bypassCache: z.boolean().optional().default(false),
});

export const TinyAgentRequestSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  goal: z.string().min(5, 'Goal must be descriptive (at least 5 characters)').max(1000, 'Goal cannot exceed 1000 characters'),
  max_steps: z.number().int().min(1).max(10).optional().default(5),
  browser_profile: z.enum(['lite', 'stealth']).optional().default('lite'),
});

export const AgriculturalResearchRequestSchema = z.object({
  category: z.enum(['mandi', 'schemes', 'crop_advisory', 'market_trends']),
  query: z.string().min(2, 'Query must be at least 2 characters').max(500),
  state: z.string().optional(),
  commodity: z.string().optional(),
  district: z.string().optional(),
  forceFresh: z.boolean().optional().default(false),
});

// Response wire schemas for validation
export const TinySearchResultItemSchema = z.object({
  position: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string().default(''),
  site_name: z.string().optional(),
  date: z.string().optional(),
});

export const TinySearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(TinySearchResultItemSchema),
  total_results: z.number().default(0),
  page: z.number().default(0),
});

export const TinyFetchResultItemSchema = z.object({
  url: z.string(),
  final_url: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  text: z.string().default(''),
  author: z.string().nullable().optional(),
  published_date: z.string().nullable().optional(),
  latency_ms: z.number().optional(),
  format: z.string().optional(),
});

export const TinyFetchResponseSchema = z.object({
  results: z.array(TinyFetchResultItemSchema),
  errors: z.array(z.object({ url: z.string(), error: z.string() })).default([]),
});

export const TinyAgentResponseSchema = z.object({
  run_id: z.string(),
  status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED', 'RUNNING', 'PENDING']),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  num_of_steps: z.number().optional(),
  result: z.any().optional(),
  error: z.any().nullable().optional(),
});
