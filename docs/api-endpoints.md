# Maui's Kitchen — API Endpoints

All endpoints require Clerk authentication. The authenticated user's ID is extracted from the session token server-side.

Base URL: `/api`

---

## Recipes

### `GET /api/recipes`
Fetch user's recipe library.

**Query params:**
- `q` — search query (title, ingredients, tags)
- `tag` — filter by tag
- `difficulty` — EASY | MEDIUM | HARD
- `favorite` — boolean
- `sort` — `newest` | `oldest` | `rating` | `name`
- `limit` — default 50
- `cursor` — pagination cursor

**Response:**
```json
{
  "recipes": [RecipeSummary],
  "nextCursor": "string | null"
}
```

---

### `GET /api/recipes/:id`
Fetch a single recipe with all fields.

**Response:** Full `Recipe` object with `ingredients`, `instructions`, `nutrition`.

---

### `POST /api/recipes/scrape`
Import recipe from URL.

**Body:**
```json
{ "url": "https://minimalistbaker.com/..." }
```

**Flow:**
1. Validate URL
2. Attempt JSON-LD extraction with `@extractus/recipe-extractor`
3. Fallback to Playwright scrape if incomplete
4. Send raw content to Claude for normalization
5. Validate with Zod
6. Write to DB
7. Return normalized recipe

**Response:** Full `Recipe` object

---

### `POST /api/recipes/import-image`
Import recipe from screenshot or photo.

**Body:** `multipart/form-data` with `file` field (JPG, PNG, WEBP, max 10MB)

**Flow:**
1. Validate file type and size
2. Upload to Supabase Storage
3. Send image URL to Claude Vision with normalization prompt
4. If multiple recipes detected → return `{ multipleRecipes: true, titles: string[] }`
5. Validate with Zod
6. Write to DB

**Response:** Full `Recipe` object OR `{ multipleRecipes: true, titles: string[], imageUrl: string }`

---

### `POST /api/recipes/import-image/select`
Resolve multi-recipe image — user selects which one.

**Body:**
```json
{ "imageUrl": "string", "selectedTitle": "string" }
```

**Response:** Full `Recipe` object

---

### `PATCH /api/recipes/:id`
Update recipe (edit title, ingredients, rating, favorite, etc.)

**Body:** Partial recipe fields (any fields from schema)

**Response:** Updated `Recipe` object

---

### `DELETE /api/recipes/:id`
Delete a recipe.

**Response:** `{ success: true }`

---

### `POST /api/recipes/:id/scale`
Return a recipe with scaled ingredient quantities (does not persist).

**Body:**
```json
{ "targetServings": 6 }
```

**Response:** Recipe with scaled ingredients + unit-converted quantities

---

## Meal Plans

### `GET /api/meal-plans`
List user's meal plans (most recent first).

**Response:** `MealPlan[]` with nested `MealPlanRecipe[]`

---

### `GET /api/meal-plans/current`
Return the current week's meal plan (or create empty one).

**Response:** `MealPlan` with `items`

---

### `POST /api/meal-plans`
Create a new meal plan.

**Body:**
```json
{
  "name": "This Week",
  "weekStartDate": "2026-03-30",
  "recipeIds": ["cuid1", "cuid2"]
}
```

**Response:** Created `MealPlan`

---

### `POST /api/meal-plans/:id/suggest`
Get recipe suggestions based on current meal plan's ingredients.

**Body:**
```json
{
  "ingredientReuseLevel": "high",
  "excludeRecipeIds": ["cuid1"]
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "recipe": RecipeSummary,
      "sharedIngredients": ["olive oil", "garlic", "chickpeas"],
      "sharedCount": 3,
      "score": 0.87
    }
  ]
}
```

---

### `PATCH /api/meal-plans/:id`
Update meal plan (add/remove recipes, lock/unlock, assign day).

**Body:**
```json
{
  "items": [
    { "recipeId": "cuid", "dayOfWeek": 0, "mealType": "DINNER", "servings": 4, "isLocked": false }
  ]
}
```

---

### `DELETE /api/meal-plans/:id`
Delete a meal plan.

---

## Pantry

### `GET /api/pantry`
Fetch all pantry items for the user.

**Response:** `PantryItem[]`

---

### `POST /api/pantry`
Add one or more pantry items.

**Body:**
```json
{
  "items": [{ "raw": "2 cups cooked chickpeas" }, { "raw": "olive oil" }]
}
```

Claude normalizes each raw string to `name`, `quantity`, `unit`, `category`.

**Response:** Created `PantryItem[]`

---

### `POST /api/pantry/from-image`
Identify pantry ingredients from a fridge/pantry photo.

**Body:** `multipart/form-data` with `file` field

**Flow:** Claude Vision identifies visible ingredients → normalized items → user confirms

**Response:**
```json
{
  "detected": [{ "name": "string", "confidence": 0.9 }]
}
```

---

### `DELETE /api/pantry/:id`
Remove a pantry item.

---

### `GET /api/pantry/suggest-recipes`
Find recipes from the user's library that match pantry contents.

**Query params:**
- `maxMissing` — max missing ingredients (default: 2)
- `limit` — default 10

**Response:**
```json
{
  "matches": [
    {
      "recipe": RecipeSummary,
      "haveCount": 8,
      "missingCount": 1,
      "missingIngredients": ["lemon"]
    }
  ]
}
```

---

## Grocery Lists

### `GET /api/grocery-lists`
List user's grocery lists.

**Response:** `GroceryList[]`

---

### `POST /api/grocery-lists/generate`
Generate grocery list from meal plan.

**Body:**
```json
{
  "mealPlanId": "cuid",
  "subtractPantry": true
}
```

**Flow:**
1. Pull all recipes + their servings from meal plan
2. Combine and de-duplicate ingredients
3. Normalize units and quantities
4. If `subtractPantry`: reduce quantities by pantry stock
5. Assign grocery aisle categories
6. Write to GroceryList + GroceryListItems

**Response:** Created `GroceryList` with items

---

### `PATCH /api/grocery-lists/:id/items/:itemId`
Edit a grocery list item (quantity, unit, name, checked state).

---

### `POST /api/grocery-lists/:id/alexa`
Push grocery list to Alexa shopping list.

**Flow:**
1. Validate Alexa credentials exist and are not expired
2. Refresh token if needed
3. Push each unchecked item to Alexa List API
4. Mark `sentToAlexa = true`

**Response:**
```json
{
  "success": true,
  "pushedCount": 14,
  "failedItems": []
}
```

Error response:
```json
{
  "success": false,
  "error": "auth_required | rate_limited | partial_failure",
  "failedItems": ["string"],
  "fallbackText": "1.5 lb chicken breast\n2 cans chickpeas\n..."
}
```

---

## Alexa Auth

### `GET /api/alexa/auth`
Redirect to Login with Amazon OAuth flow.

### `GET /api/alexa/callback`
OAuth callback — stores encrypted tokens.

### `DELETE /api/alexa/disconnect`
Remove Alexa credentials.

---

## Error Format

All errors follow:
```json
{
  "error": {
    "code": "RECIPE_SCRAPE_FAILED",
    "message": "Could not extract recipe from this URL.",
    "details": {}
  }
}
```

Standard error codes:
- `UNAUTHORIZED` — no valid session
- `NOT_FOUND` — resource not found or not owned by user
- `VALIDATION_ERROR` — request body failed Zod validation
- `SCRAPE_FAILED` — recipe URL could not be scraped
- `AI_ERROR` — Claude API returned invalid or unparseable response
- `ALEXA_AUTH_REQUIRED` — no Alexa credentials
- `ALEXA_PUSH_FAILED` — Alexa API error
