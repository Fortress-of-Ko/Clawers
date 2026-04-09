# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clawers is a premium claw machine (뽑기) discovery platform — spot finder with maps, community posts, reviews, and YouTube video integration. Supports 4 languages (ko, en, ja, zh). Korea-centric (Asia/Seoul timezone).

## Commands

All commands run from `web/`:

```bash
npm run dev      # Next.js dev server
npm run build    # Production build (strict TypeScript)
npm run lint     # ESLint
npm test         # Vitest (run single: npx vitest run lib/shared.test.ts)
```

## Architecture

**Stack:** Next.js 15 (App Router) + React 19 + Supabase (PostgreSQL + Auth) + Tailwind CSS 4 + next-intl

### Directory Layout

- `web/app/api/` — REST API routes (spots, posts, notifications, upload)
- `web/app/[locale]/` — Internationalized pages (map, community, watch, spot detail)
- `web/components/` — React components (community/, spot/ subdirectories)
- `web/lib/supabase/` — Three Supabase clients: `client.ts` (browser), `server.ts` (SSR), `admin.ts` (service role)
- `web/lib/utils/` — Kakao Maps, OpenStreetMap, YouTube helpers
- `web/messages/` — i18n translation files (EN is base; others override with fallback)
- `supabase/migrations/` — PostgreSQL migrations (001-007)

### Key Patterns

**Data mutations go through Supabase RPCs, not direct SQL.** All write operations use SECURITY DEFINER stored procedures (e.g., `clawers_toggle_like`, `clawers_upsert_spot_review`) for atomicity and race-safety. The like toggle uses a DELETE-first pattern. Spot avg_rating uses incremental calculation (O(1), no recompute).

**Auth flow:** Supabase Auth via middleware session extraction. `useAuth()` hook for browser-side state. API routes check `auth.uid()` and return 401 if missing. RLS policies enforce row-level access.

**Rate limiting:** In-memory store in `lib/rate-limit.ts` keyed by user ID. Per-endpoint limits (e.g., 10 for posts, 30 for likes).

**i18n:** next-intl with recursive message merging — English base with locale-specific overrides. Locale routing handled in middleware.

**Image uploads:** Reviews upload to Supabase Storage bucket `clawers-reviews` with path `{spotId}/{reviewId}/{index}.webp`.

**CSP:** Strict Content-Security-Policy in `next.config.js` whitelisting Kakao Maps, YouTube, Supabase, OSM, Nominatim, Overpass.

### Path Alias

`@/*` maps to the `web/` root (configured in tsconfig.json).
