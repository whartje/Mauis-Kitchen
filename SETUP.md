# Maui's Kitchen — Setup Guide

## Prerequisites

- Node.js 20+
- npm or pnpm
- A Supabase account (free tier works)
- A Clerk account (free tier works)
- An Anthropic API key

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Get your keys:

**Clerk** (authentication):
1. Go to [clerk.com](https://clerk.com) → Create application
2. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

**Supabase** (database + file storage):
1. Go to [supabase.com](https://supabase.com) → New project
2. Copy `DATABASE_URL` from Settings → Database → Connection string (URI mode)
3. Copy `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Settings → API
4. Create a storage bucket named `recipe-images` (set to Public)

**Anthropic** (AI normalization):
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Copy your API key as `ANTHROPIC_API_KEY`

---

## 3. Set up the database

Generate Prisma client and push schema to your Supabase Postgres:

```bash
npm run db:generate
npm run db:push
```

For subsequent schema changes, use migrations:

```bash
npm run db:migrate
```

---

## 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 5. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all `.env.local` variables to your Vercel project environment settings.

---

## Development Tips

- Use `npm run db:studio` to open Prisma Studio (visual DB browser)
- The Claude API is called server-side only — your API key is never exposed to the client
- Recipe images are stored in Supabase Storage under the `recipe-images` bucket, organized by `userId/timestamp-filename`

---

## Phase Completion Checklist

- [x] Phase 1: Recipe import (URL + image), library, detail view, scaling
- [ ] Phase 2: Meal planning with ingredient overlap suggestions
- [ ] Phase 3: Grocery list generation + Alexa integration
- [ ] Phase 4: Pantry mode (type/voice/photo)
- [ ] Phase 5: Polish, mobile, search, settings
