# Government Assistance Module v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a production-grade, offline-first Government Agricultural Schemes and Farmer Assistance module in AgriDOST within a 3.5-hour execution sprint, featuring verified scheme intelligence, deterministic eligibility evaluation, interactive application tracking, document assistance, Supabase RLS migrations, reminders, multilingual support (Hindi/English), and grounded AI assistance.

**Architecture:** A layered architecture integrating with AgriDOST's existing AppShell. Includes:
1. Core Scheme Registry & Deterministic Rule Engine (`src/lib/schemes/`)
2. Reactive Storage & Application Tracker with Supabase Client & RLS SQL migrations (`src/lib/supabase/`, `supabase/migrations/`)
3. Interactive Farmer UI Workflows (`src/components/schemes/`)
4. Server-Side Grounded AI Assistance Route (`src/app/api/ai/schemes/`) & Multilingual Support (`src/lib/i18n/`)

**Tech Stack:** Next.js 16.4.6, React 19.3.0, TypeScript 5, Tailwind CSS v4, Lucide React, Zod, Vitest.

**Spec:** Section 1-13 of AgriDOST 3.5-Hour Execution Sprint Specification.

## Global Constraints
- Preserve all 142 existing tests in `tests/agronomy.test.ts`, `tests/ai-api-storage.test.ts`, and `tests/geospatial.test.ts`.
- Zero fake integrations: clearly distinguish user-reported application status from government-verified status.
- Zero invented subsidies or links: all schemes cite official government URLs (`myscheme.gov.in`, `pmkisan.gov.in`, `pmfby.gov.in`, `agriinfra.dac.gov.in`, etc.).
- Offline-first: full functionality without internet using local repository fallback.
- Server-side AI: no API keys exposed to frontend bundles.

---

## Team Structure & File Ownership

| Agent | Workstream | Owned Files |
|---|---|---|
| **Lead / Orchestrator** | Shared Types, Navigation & AppShell Integration, Build & Synthesis | `src/types/schemes.ts`, `src/types/index.ts`, `src/components/layout/Sidebar.tsx`, `src/app/page.tsx` |
| **Agent A** | Scheme Intelligence & Eligibility Engine | `src/lib/schemes/registry.ts`, `src/lib/schemes/eligibility-engine.ts`, `src/lib/schemes/rules.ts`, `src/lib/schemes/index.ts`, `tests/schemes-eligibility.test.ts` |
| **Agent B** | UI & Farmer Workflows | `src/components/schemes/SchemesOverview.tsx`, `src/components/schemes/SchemeDetailModal.tsx`, `src/components/schemes/EligibilityWizard.tsx`, `src/components/schemes/DocumentAssistant.tsx`, `src/components/schemes/ApplicationAssistant.tsx`, `src/components/schemes/index.ts` |
| **Agent C** | Supabase Persistence, RLS & Application Tracker | `src/components/schemes/ApplicationTracker.tsx`, `src/components/schemes/ReminderManager.tsx`, `src/lib/supabase/client.ts`, `src/lib/supabase/scheme-repository.ts`, `supabase/migrations/20261122_government_assistance.sql`, `tests/schemes-storage-rls.test.ts` |
| **Agent D** | AI Grounding, Multilingual Support & QA | `src/app/api/ai/schemes/route.ts`, `src/lib/ai/schemes-prompt.ts`, `src/lib/i18n/schemes-dict.ts`, `src/components/schemes/SchemeAIAssistant.tsx`, `tests/schemes-ai-i18n.test.ts` |

---

## Tasks & Phases

### Task 1: Main Orchestrator — Define Shared Data Contracts (`src/types/schemes.ts` & `src/types/index.ts`)
- [ ] Create `src/types/schemes.ts` with complete types for Schemes, Documents, Eligibility, Applications, and Reminders.
- [ ] Export scheme types from `src/types/index.ts`.
- [ ] Verify TypeScript compiles without errors.

### Task 2: AGENT A — Verified Scheme Registry & Deterministic Eligibility Engine
- [ ] Create `src/lib/schemes/registry.ts` with 8 verified central and state schemes from official portals.
- [ ] Create `src/lib/schemes/rules.ts` and `src/lib/schemes/eligibility-engine.ts` using strict deterministic validation with Zod schemas.
- [ ] Create `tests/schemes-eligibility.test.ts` testing all eligibility scenarios (eligible, ineligible, more info needed, edge cases).
- [ ] Run vitest to ensure all new and existing tests pass.

### Task 3: AGENT C — Supabase Migrations, RLS Policies & Application Storage
- [ ] Create `supabase/migrations/20261122_government_assistance.sql` containing tables, foreign keys, indexes, and comprehensive RLS policies.
- [ ] Create `src/lib/supabase/client.ts` and `src/lib/supabase/scheme-repository.ts` implementing offline-first storage with seamless Supabase cloud fallback.
- [ ] Create `src/components/schemes/ApplicationTracker.tsx` and `src/components/schemes/ReminderManager.tsx`.
- [ ] Create `tests/schemes-storage-rls.test.ts` testing application tracking, state transitions, and offline persistence.

### Task 4: AGENT B — UI & Farmer Experience
- [ ] Create `src/components/schemes/SchemesOverview.tsx` (Recommended schemes, search, filtering by state/level/category, metrics).
- [ ] Create `src/components/schemes/SchemeDetailModal.tsx` (Deep dive with verification badge, source attribution, instructions).
- [ ] Create `src/components/schemes/EligibilityWizard.tsx` (Interactive questionnaire pre-filled with farm data, transparent results).
- [ ] Create `src/components/schemes/DocumentAssistant.tsx` (Checklist with procurement instructions and zero sensitive data leaks).
- [ ] Create `src/components/schemes/ApplicationAssistant.tsx` (Guided steps, portal links, application reference entry).
- [ ] Export everything via `src/components/schemes/index.ts`.

### Task 5: AGENT D — Grounded AI Assistant, Multilingual Dictionaries & QA
- [ ] Create `src/lib/i18n/schemes-dict.ts` providing Hindi and English translations for scheme terminology, statuses, and navigation.
- [ ] Create `src/lib/ai/schemes-prompt.ts` with anti-hallucination prompt, system rules, and verified source grounding.
- [ ] Create `src/app/api/ai/schemes/route.ts` with server-side Gemini integration and offline fallback.
- [ ] Create `src/components/schemes/SchemeAIAssistant.tsx` (Interactive AI chat grounded in selected schemes with source citations).
- [ ] Create `tests/schemes-ai-i18n.test.ts` testing grounding constraints, dictionary completeness, and fallback behavior.

### Task 6: Main Orchestrator — Navigation Integration, Final Synthesis & Verification
- [ ] Update `src/components/layout/Sidebar.tsx` adding 'schemes' (Government Assistance) tab.
- [ ] Update `src/app/page.tsx` rendering the Government Assistance suite.
- [ ] Run full test suite (`npm test`), lint (`npm run lint`), and build (`npm run build`).
- [ ] Verify UI in browser and capture screenshot evidence.
- [ ] Produce Final Execution Report.
