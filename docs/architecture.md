# Maui's Kitchen — Tech Stack & Architecture

## Recommended Stack

### Frontend
- **Next.js 14+ (App Router)** — server components, file-based routing, API routes in one repo
- **React 18** — UI component model
- **TypeScript** — type safety across the entire codebase
- **Tailwind CSS** — utility-first, fast dark-mode theming
- **shadcn/ui** — unstyled component primitives, fully customizable to our design system

### Authentication
- **Clerk** — best-in-class Next.js integration, handles OAuth, JWTs, session management, email magic links. Faster to integrate than Auth0. Free tier is sufficient for MVP.

### Database
- **PostgreSQL** — relational, handles recipe ingredient joins and meal plan relations naturally
- **Prisma ORM** — type-safe queries, migrations, schema-as-code
- **Supabase** — managed Postgres + file storage for recipe images/screenshots. Supabase Storage replaces the need for S3.

### AI & OCR
- **Claude API (claude-sonnet-4-6)** — recipe normalization from text, OCR from images, pantry photo analysis, ingredient overlap recommendations
  - Why Claude over GPT-4: structured JSON output is more reliable, vision capabilities handle cookbook photos better
- **@extractus/recipe-extractor** — schema.org/Recipe JSON-LD extraction from recipe sites (fast, no headless browser needed)
- **Playwright** (fallback) — headless scraping for sites that block simple HTTP requests

### Unit Conversion
- **mathjs** — handles precise fraction arithmetic for ingredient scaling
- Custom unit normalization table (tbsp→cup, oz→lb, ml→L, g→kg)

### Alexa Integration
- **Amazon Alexa Shopping List API** via Login with Amazon (LWA) OAuth
- Fallback: plain text export, clipboard copy

### Hosting
- **Vercel** — Next.js deployment, edge functions, automatic preview deployments
- **Supabase** — Postgres database + image/file storage

### Additional
- **Zod** — runtime schema validation for all API inputs and Claude responses
- **SWR** — client-side data fetching with optimistic updates
- **react-hook-form** — form state management for recipe editing
- **date-fns** — date formatting for meal plan calendar

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Next.js App (App Router)             │   │
│  │                                                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │   │
│  │  │  Pages   │  │  Server  │  │  API Routes   │  │   │
│  │  │ (React)  │  │Components│  │  /api/**      │  │   │
│  │  └──────────┘  └──────────┘  └───────┬───────┘  │   │
│  └────────────────────────────────────┬─┘───────────┘   │
│                                       │                 │
└───────────────────────────────────────┼─────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────┐
              │                         │                  │
       ┌──────▼──────┐        ┌────────▼────────┐  ┌──────▼──────┐
       │  Supabase   │        │   Claude API    │  │  Clerk Auth │
       │  Postgres   │        │  (Anthropic)    │  │             │
       │  + Storage  │        │                 │  │             │
       └─────────────┘        └─────────────────┘  └─────────────┘
              │
       ┌──────▼──────┐
       │  Amazon     │
       │  Alexa API  │
       └─────────────┘
```

---

## Data Flow: Recipe Import (URL)

```
1. User pastes URL
2. POST /api/recipes/scrape { url }
3. API tries @extractus/recipe-extractor (JSON-LD schema.org)
4. If result is incomplete → Playwright scrape fallback
5. Raw text sent to Claude API with normalization prompt
6. Claude returns typed RecipeSchema JSON
7. Zod validates output
8. Prisma writes to Postgres
9. Response returns normalized recipe to client
10. Client optimistically shows recipe in library
```

## Data Flow: Recipe Import (Image/Screenshot)

```
1. User uploads image
2. POST /api/recipes/import-image { file }
3. Image uploaded to Supabase Storage
4. Claude Vision API analyzes image
5. Prompt: "Extract and normalize this recipe into JSON"
6. If multiple recipes detected → return list of titles, ask user
7. Zod validates Claude output
8. Prisma writes recipe
9. Return normalized recipe
```

## Data Flow: Grocery List → Alexa

```
1. User clicks "Send to Alexa"
2. Check if Alexa OAuth token exists for user
3. If not → redirect to Login with Amazon OAuth flow
4. POST /api/grocery-list/alexa { items }
5. For each item: POST to Alexa List Management API
6. If any fail → show retry UI
7. If Alexa unavailable → show copyable plaintext fallback
```

---

## Security Considerations

- All API routes require Clerk authentication
- User data is strictly scoped by userId — no cross-user data access
- Image uploads are validated for type and size before Supabase upload
- Claude API responses are always validated through Zod before DB write
- Alexa OAuth tokens stored encrypted in Postgres, not in client
- Environment variables: Claude API key, Supabase key, Amazon client secret never exposed to client bundle

---

## Offline Strategy (V1 Partial)

- Recipe data cached in SWR with localStorage fallback
- Pantry data written to localStorage as secondary store
- Full offline (Service Worker + IndexedDB) deferred to V2

---

## Why Not...

| Option | Rejected Because |
|---|---|
| Auth0 | More complex setup, Clerk has better Next.js DX |
| Firebase | Not relational; ingredient joins are awkward in Firestore |
| OpenAI GPT-4o | Claude Vision produces more consistent structured JSON for recipes |
| Tesseract.js | Server-side OCR quality is poor vs. Claude Vision; adds unnecessary complexity |
| PlanetScale | MySQL syntax; Prisma+Supabase Postgres is cleaner |
| tRPC | Adds complexity for a solo/small-team project; typed fetch is sufficient |
