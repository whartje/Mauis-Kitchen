# Maui's Kitchen — Build Plan

## Phase 1: Foundation + Recipe Import (Week 1–2)

**Goal:** Users can import, view, and manage recipes.

### Tasks
- [ ] Initialize Next.js 14 project (App Router, TypeScript, Tailwind)
- [ ] Set up shadcn/ui and design system (dark theme, color tokens)
- [ ] Configure Clerk authentication (sign-up, sign-in, session)
- [ ] Set up Supabase (Postgres + Storage bucket)
- [ ] Write Prisma schema and run initial migration
- [ ] Build sidebar navigation + base layout
- [ ] Build Recipe Library page (empty state + grid)
- [ ] Build Import Recipe modal (URL tab)
- [ ] Implement `/api/recipes/scrape` with @extractus/recipe-extractor
- [ ] Implement Claude normalization prompt (POST to Anthropic API)
- [ ] Implement Zod schema validation for Claude response
- [ ] Build Recipe Detail page (view, not yet editable)
- [ ] Implement serving scaling (client-side math)
- [ ] Unit conversion utility (tbsp→cup, oz→lb, etc.)
- [ ] Build Import from Photo modal + `/api/recipes/import-image`
- [ ] Favorites (toggle heart, filter in library)
- [ ] "Mark as Made" + star rating

**Milestone:** User can paste a URL → recipe is in their library → view and scale it.

---

## Phase 2: Meal Planning (Week 3–4)

**Goal:** Users can build a weekly meal plan and get recipe suggestions.

### Tasks
- [ ] Build Meal Plan page with recipe picker + calendar grid
- [ ] Implement `/api/meal-plans` CRUD
- [ ] Ingredient overlap algorithm (score recipes by shared ingredients)
- [ ] Build suggestion drawer UI
- [ ] Implement ingredient reuse level control
- [ ] Recipe locking toggle
- [ ] Meal plan calendar drag-and-drop (react-dnd or dnd-kit)
- [ ] Persist meal plan to DB

**Milestone:** User can select recipes, get suggestions, and build a week's plan.

---

## Phase 3: Grocery List (Week 5)

**Goal:** Auto-generate grocery list from meal plan; send to Alexa.

### Tasks
- [ ] Implement ingredient combining algorithm (sum quantities, normalize units)
- [ ] Implement grocery aisle categorization (Claude-assisted or rule-based lookup table)
- [ ] Build Grocery List page (grouped by aisle)
- [ ] Inline editing of list items
- [ ] Implement Login with Amazon OAuth flow
- [ ] Store/refresh Alexa tokens (encrypted)
- [ ] Implement Alexa List Management API push
- [ ] Build retry UI and copy-list fallback
- [ ] "Pantry subtract" option (reduce grocery qty by pantry stock)

**Milestone:** User generates grocery list and pushes to Alexa in one tap.

---

## Phase 4: Pantry Mode (Week 6)

**Goal:** Users can log pantry contents and discover what they can cook.

### Tasks
- [ ] Build Pantry page with type/voice/photo inputs
- [ ] Implement text ingredient normalization via Claude
- [ ] Implement Web Speech API for voice input
- [ ] Implement pantry photo → Claude Vision ingredient detection
- [ ] Build recipe matching algorithm (pantry vs. recipe ingredients)
- [ ] Build results UI (Ready to Cook / Almost / Partial)
- [ ] "Add to Meal Plan" from pantry results

**Milestone:** User enters pantry contents and gets accurate recipe suggestions.

---

## Phase 5: Polish + Launch Prep (Week 7–8)

### Tasks
- [ ] Responsive mobile layout (all screens)
- [ ] Loading skeletons on all data-fetching routes
- [ ] Optimistic UI for import and grocery list actions
- [ ] Error boundary components
- [ ] Toast notification system
- [ ] Recipe library search (full-text via Postgres `tsvector`)
- [ ] Tag filtering
- [ ] Settings page (account, Alexa, preferences)
- [ ] Recipe export (JSON)
- [ ] SWR caching + stale-while-revalidate
- [ ] Vercel deployment
- [ ] Environment variable configuration
- [ ] Basic analytics (Vercel Analytics)
- [ ] Manual QA pass: import from all 6 priority recipe sites

**Milestone:** Production-ready MVP deployed to Vercel.

---

## MVP vs Version 2 Feature Matrix

| Feature | MVP | V2 |
|---|---|---|
| Recipe import from URL | ✓ | |
| Recipe import from image | ✓ | |
| Recipe library + favorites | ✓ | |
| Recipe scaling | ✓ | |
| Recipe rating + history | ✓ | |
| Basic meal planning | ✓ | |
| Ingredient overlap suggestions | ✓ | |
| Grocery list generation | ✓ | |
| Alexa shopping list push | ✓ | |
| Pantry mode (type + voice + photo) | ✓ | |
| Grocery aisle grouping | ✓ | |
| Unit normalization | ✓ | |
| Mobile responsive | ✓ | |
| Drag-and-drop meal calendar | ✓ | |
| Offline support (Service Worker) | | ✓ |
| Native iOS/Android app | | ✓ |
| Household/shared accounts | | ✓ |
| Pantry quantity tracking | | ✓ |
| Grocery delivery integration | | ✓ |
| Advanced nutrition goals | | ✓ |
| Recipe collections/folders | | ✓ |
| More recipe source parsers | | ✓ |
| Recipe notes per cook | | ✓ |
| Leftover tracking | | ✓ |
| Meal prep schedule (batch cooking) | | ✓ |
| AI meal plan optimization (full) | | ✓ |

---

## "Wow Factor" Feature: Pantry to Plan in 60 Seconds

**The differentiator no competitor has:**

> A single camera scan of your fridge and pantry that builds a complete, optimized 5-day meal plan in under 60 seconds — showing only recipes you have 80%+ of the ingredients for, ordered by prep time, with a pre-approved grocery list for the gaps.

**How it works:**
1. User clicks "Plan My Week from Pantry" on the Dashboard
2. Takes 2–3 photos: fridge, pantry shelf, spice rack
3. Claude Vision identifies and catalogs all visible ingredients
4. Matching algorithm finds top 10 recipes from user's library with >80% coverage
5. Claude selects 5 meals with ingredient overlap optimization
6. Grocery list generated for the missing ~20%
7. Total elapsed time: under 60 seconds from photo to plan

**Why this wins:**
- Paprika: has a grocery list, no AI pantry analysis
- AnyList: great grocery list, no recipe planning
- Mealime: has meal planning, no pantry mode, no AI
- Pinterest: saves recipes, no planning layer at all

Maui's Kitchen is the only product that goes from **what's in my fridge** → **complete week of cooking** → **gaps ready to order** in one flow.
