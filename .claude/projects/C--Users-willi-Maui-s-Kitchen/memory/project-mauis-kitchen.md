---
name: Maui's Kitchen Project Overview
description: Core context for the Maui's Kitchen meal planning app — stack, phase status, and key decisions
type: project
---

Maui's Kitchen is a full-stack meal planning and recipe management web app. Phase 1 is functionally complete and running locally.

**Why:** Reduce grocery planning friction for meal preppers and home cooks. Core pain points: ingredient overlap planning, consolidated grocery lists, pantry-first recipe discovery.

**Stack:** Next.js 15.3+ (App Router) + TypeScript + Tailwind CSS + Clerk auth + Supabase (Postgres + Storage) + Prisma ORM. Anthropic Claude API not yet connected (deferred — user opted out for now).

**Design system:** Dark-mode only. Matte black (#1A1A1A) bg, cream (#F5EDD8) text, warm orange (#E8834A) accent. Logo is `public/maui-cat.png.png` (user-provided walking cat silhouette, white on dark via CSS filter invert). Cat used only in branding.

**Dev server:** Runs on localhost:3000–3003 (port varies). Start with `npm run dev` from project root.

**Phase 1 status — COMPLETE:**
- Clerk auth (sign-in, sign-up, middleware protection)
- Recipe import from URL (JSON-LD scraper with unquoted attribute support, microdata fallback, Cloudflare detection)
- Recipe library with search, filters (meal type, time range, food groups/diet, difficulty, favorites), sort
- Recipe detail with live ingredient scaling + unit conversion
- Star rating + favorites toggle
- All CRUD API routes for recipes
- Prisma schema with all 9 models pushed to Supabase

**Known issues / deferred:**
- Lazy Cat Kitchen and some sites: may fail if JSON-LD is JS-rendered (Cloudflare or client-side schema). No fix without Claude API or Playwright.
- Photo/screenshot import disabled (requires Claude API key)
- `public/maui-cat.png.png` has double extension — works fine, just cosmetically odd

**Phase 2 — NOT STARTED:** Meal planning (recipe picker, calendar, ingredient overlap suggestions, lock recipes)
**Phase 3 — NOT STARTED:** Grocery list generation + Alexa integration
**Phase 4 — NOT STARTED:** Pantry mode (type/voice/photo input, recipe matching)
**Phase 5 — NOT STARTED:** Polish, mobile, offline, deploy to Vercel

**How to apply:** When continuing work, check phase status above. Phase 2 (meal planning) is the next priority.
