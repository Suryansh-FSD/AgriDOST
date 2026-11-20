# AgriDOST — Vercel Production Deployment Guide

## 1. Quick Deploy Summary
AgriDOST is engineered to deploy seamlessly to Vercel without architectural restructuring, external databases, or complex background queues.

- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Node.js Version:** 20.x or 22.x

---

## 2. Environment Variables

Only two environment variables are needed:

| Variable | Environment | Required? | Fallback Behavior if Omitted |
|---|---|---|---|
| `GEMINI_API_KEY` | Server-only (`.env.local` / Vercel secrets) | Recommended for live AI | UI displays a clear advisory banner and provides pre-diagnostic sample guides. Does NOT crash or fabricate fake AI responses. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client-accessible | Optional | The app automatically defaults to the interactive vector SVG polygon mapper. 100% functional offline. |

> [!IMPORTANT]
> Never prefix `GEMINI_API_KEY` with `NEXT_PUBLIC_`. All Gemini calls route through `src/app/api/ai/health/route.ts` to keep API keys secure on the server.

---

## 3. Pre-Deployment Verification Checklist

Before pushing to production or submitting to hackathon judges:

```bash
# 1. Verify TypeScript types
npx tsc --noEmit

# 2. Run Next.js production build
npm run build

# 3. Test production server locally
npm run start
```

---

## 4. LocalStorage & Persistence on Vercel
- All farm boundaries, crop zones, disease scans, and activity reminders persist in the user's browser via `window.localStorage`.
- Three verified demonstration farms (`Green Valley Agro Park`, `Surya Precision Orchards`, `Krishna Delta Agro Sanctuary`) auto-seed on the first visit with explicit `[DEMO DATA]` badges.
- Users can reload clean demo data anytime using the **Reset Demo** button in the header.

---

## 5. Anti-Hallucination Guardrails
- **Area & Perimeter:** Calculated deterministically in code via `@turf/turf` (Turf.js).
- **Gemini Outputs:** Validated against strict Zod schemas with mandatory disclaimers and limitations before rendering.
- **Drone Spray:** Requires human verification confirmation before exporting standard RFC 7946 `.geojson` files.
