# Maui's Kitchen — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-31
**Status:** Active

---

## 1. Executive Summary

Maui's Kitchen is a meal planning and recipe management web application that eliminates the friction between discovering recipes and getting groceries. It imports recipes from websites and photos, builds optimized weekly meal plans, and generates consolidated grocery lists — including direct push to the user's Alexa shopping list.

The product is opinionated, fast, and clean. It is not a social platform. It is a personal kitchen operating system.

---

## 2. Problem Statement

Home cooks waste significant time on:
- Copying recipes from multiple websites into notes
- Manually building grocery lists
- Buying duplicate ingredients because they didn't realize two recipes share them
- Forgetting what's in their pantry
- Starting from scratch each week instead of building on what they already have

No existing product (Paprika, AnyList, Pinterest, Mealime) solves all of these together with a fast, modern, AI-assisted experience.

---

## 3. Target Users

### Primary Persona: The Meal Prepper
- Cooks 4–6 meals per week in batches
- Wants to minimize grocery trips
- Values efficiency over discovery
- Often has dietary restrictions (vegan, gluten-free, high-protein)

### Secondary Persona: The Reluctant Grocery Planner
- Hates building grocery lists
- Wants to use what's already in the fridge
- Needs a system that works with minimal effort

---

## 4. Goals and Non-Goals

### Goals
- Import recipes from URLs and photos with zero manual correction needed
- Build weekly meal plans optimized for ingredient overlap
- Generate a single, de-duplicated grocery list
- Push grocery list to Alexa with one tap
- Suggest recipes based on pantry contents

### Non-Goals (MVP)
- Social sharing or community features
- Grocery delivery integration
- Nutritional coaching or goal-setting
- Native mobile apps
- Restaurant recommendations

---

## 5. Feature Requirements

### 5.1 Recipe Import

| Requirement | Priority |
|---|---|
| Import recipe from public URL | P0 |
| Scrape recipe websites (title, ingredients, instructions, meta) | P0 |
| Import from screenshot or photo using OCR + AI | P0 |
| Normalize to standard schema automatically | P0 |
| Save to personal recipe library | P0 |
| Preserve source attribution and original URL | P0 |
| Handle multi-recipe images (ask user which to import) | P1 |
| Offline cache of imported recipes | P2 |

**Priority recipe sources:**
1. plantyou.com
2. ohsheglows.com
3. thefirstmess.com
4. lazycatkitchen.com
5. thehappypear.ie
6. minimalistbaker.com

### 5.2 Recipe Normalization Schema

Every recipe must be stored as:

```
title: string
description: string
ingredients: Ingredient[]
  - name: string
  - quantity: number | null
  - unit: string | null
  - raw: string           // original text preserved
  - notes: string | null  // "to taste", "optional", etc.
instructions: Step[]
  - stepNumber: number
  - text: string
servings: number
prepTime: number (minutes)
cookTime: number (minutes)
totalTime: number (minutes)
difficulty: "easy" | "medium" | "hard"
nutrition: NutritionFacts | null
rating: 1–5 stars | null
tags: string[]
sourceUrl: string | null
sourceName: string | null
imageUrl: string | null
importedAt: datetime
```

### 5.3 Meal Planning

| Requirement | Priority |
|---|---|
| User selects 3–4 seed recipes | P0 |
| App suggests recipes with overlapping ingredients | P0 |
| User can lock recipes, system builds around them | P0 |
| Ingredient reuse setting (Low / Medium / High) | P1 |
| Optimize for prep time | P1 |
| Optimize for nutrition goals | P2 |
| Leftovers count as additional meal | P2 |

### 5.4 Pantry Mode

| Requirement | Priority |
|---|---|
| Manual ingredient entry | P0 |
| Voice input via browser Web Speech API | P1 |
| Photo upload → AI identifies ingredients | P1 |
| Suggest recipes missing 0–2 ingredients | P0 |
| Show partial matches with missing ingredient count | P1 |
| Reduce pantry quantities after recipes are selected | P2 |

### 5.5 Grocery List

| Requirement | Priority |
|---|---|
| Auto-combine ingredients across selected recipes | P0 |
| Unit normalization (1 lb + 8 oz = 1.5 lb) | P0 |
| Group by grocery aisle/category | P0 |
| Manual editing before submission | P0 |
| Push to Alexa shopping list | P0 |
| Retry flow on Alexa failure | P1 |
| Fallback copyable list | P0 |

### 5.6 Recipe Scaling

| Requirement | Priority |
|---|---|
| Change serving count | P0 |
| Scale all ingredient quantities | P0 |
| Auto unit conversion (16 tbsp → 1 cup) | P0 |
| Optional cooking time adjustment | P2 |

---

## 6. UX Principles

1. **Dark-mode first.** Backgrounds are charcoal/matte black. Text is warm cream. Accent is warm orange.
2. **Zero-confirmation import.** AI should parse and save without requiring field-by-field approval.
3. **One-tap actions.** Grocery list to Alexa should be a single button.
4. **No mascot.** Maui the cat appears only in branding/icon. The product UI is clean and food-focused.
5. **Speed.** Pages should feel instant. Use optimistic UI and skeleton loaders.

---

## 7. Success Metrics (MVP)

- Time from URL paste to recipe saved: < 10 seconds
- Grocery list generation from 4 recipes: < 5 seconds
- Recipe import success rate (URL): > 90%
- Alexa push success rate: > 95%
- User returns to plan a second week: > 60% within 14 days

---

## 8. Constraints

- No backend infra management — use managed services (Vercel, Supabase)
- Alexa integration is constrained by Amazon's OAuth flow and API rate limits
- OCR accuracy depends on image quality — graceful degradation required
- Vague ingredient quantities must be preserved exactly as written

---

## 9. Open Questions

- Should users be able to share a grocery list (read-only link) without sharing their account?
- Should the app support household accounts (multiple users, one pantry)?
- What happens when a recipe URL goes dead after import?
