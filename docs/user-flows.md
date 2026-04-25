# Maui's Kitchen — Core User Flows

---

## Flow 1: First-Time User Onboarding

```
Land on marketing page
  → Click "Get Started"
  → Clerk sign-up (email or Google)
  → Redirected to empty Dashboard
  → Onboarding banner: "Import your first recipe to get started"
  → User clicks "Import Recipe"
```

---

## Flow 2: Import Recipe from URL

```
Recipe Library (or Dashboard)
  → Click "Import Recipe"
  → Import modal opens (two tabs: "From URL" | "From Photo")
  → "From URL" tab is default
  → User pastes URL (e.g. minimalistbaker.com/...)
  → Click "Import"
  → Loading state: "Fetching recipe..."
  → [Server: scrape → Claude normalize → DB write]
  → Loading state: "Normalizing with AI..."
  → Success: Recipe card appears in library
  → Toast: "Recipe imported!"
  → Optionally open recipe detail immediately
```

**Error path:**
```
  → If URL scrape fails:
    → Toast: "Couldn't extract this recipe automatically"
    → Offer: "Paste the recipe text instead"
    → Manual text → Claude normalize path
```

---

## Flow 3: Import Recipe from Screenshot/Photo

```
Recipe Library
  → Click "Import Recipe" → "From Photo" tab
  → Drag-and-drop or click to upload image
  → Loading: "Reading recipe from image..."
  → [Server: upload to Supabase → Claude Vision → Zod validate]
  → IF single recipe detected:
      → Recipe appears in library
      → Toast: "Recipe imported!"
  → IF multiple recipes detected:
      → Modal: "We found multiple recipes in this image. Which one would you like to import?"
      → List of recipe titles (radio buttons)
      → Click "Import This One"
      → Recipe saved
```

---

## Flow 4: Build a Weekly Meal Plan

```
Dashboard or "Meal Plan" section
  → Click "New Meal Plan" (or current week auto-loads)
  → Meal Plan builder opens
  → Step 1: "Pick your anchor recipes"
    → Search/browse recipe library
    → Select 1–4 recipes, click "Lock" toggle on any that are must-haves
    → Click "Find matches"
  → Step 2: System suggests recipes with ingredient overlap
    → Ingredient reuse level slider (Low / Medium / High)
    → Each suggestion shows: shared ingredient count + tags
    → User adds suggestions to plan or dismisses
  → Step 3: Meal plan grid (Mon–Sun × Breakfast/Lunch/Dinner)
    → Drag recipes into day slots (optional; can leave unscheduled)
  → Step 4: Click "Generate Grocery List"
    → Grocery list auto-generated (see Flow 5)
```

---

## Flow 5: Generate and Send Grocery List

```
Meal Plan view
  → Click "Generate Grocery List"
  → [Server: combine ingredients → normalize units → subtract pantry (if enabled)]
  → Grocery List view opens
  → Items grouped by aisle (Produce, Protein, Pantry, Dairy, etc.)
  → User can:
    → Check off items already owned
    → Edit quantities/units inline
    → Add additional items manually
    → Delete items
  → Click "Send to Alexa"
  → IF Alexa not connected:
      → "Connect Alexa" modal → Login with Amazon OAuth
      → After auth: retry send
  → IF Alexa connected:
      → Loading: "Sending to Alexa..."
      → Success toast: "14 items added to your Alexa shopping list!"
  → IF Alexa fails:
      → Error toast + "Retry" button
      → "Copy List" button → clipboard fallback
```

---

## Flow 6: Pantry Mode — Find Recipes from What You Have

```
Pantry section
  → Choose input method:
    [ Type ingredients ] [ Voice input ] [ Photo ]

  TYPE path:
    → Text field: "What's in your fridge/pantry?"
    → User types: "chickpeas, spinach, lemon, tahini"
    → "Find Recipes" button

  VOICE path:
    → Click microphone icon
    → Browser Web Speech API activates
    → User speaks: "I have chicken, garlic, lemon, and potatoes"
    → Text auto-populated
    → "Find Recipes" button

  PHOTO path:
    → Upload fridge/pantry photo
    → Claude identifies ingredients, shows detected list
    → User removes false positives
    → "Find Recipes" button

  → [Server: match pantry items against all user recipes]
  → Results: three sections:
    1. "Can make now" (0 missing ingredients)
    2. "Almost there" (1–2 missing ingredients)
    3. "Partial matches" (3+ missing, shown as inspiration)
  → Each card shows: recipe thumbnail, missing ingredient pills
  → Click recipe → open detail view
  → "Add to Meal Plan" button on each
```

---

## Flow 7: Scale a Recipe

```
Recipe Detail view
  → Click serving count (e.g. "4 servings")
  → Inline input: change to desired count (e.g. 8)
  → Ingredient list updates instantly (client-side math)
  → Units auto-convert: "16 tbsp olive oil" → "1 cup olive oil"
  → "Save to Meal Plan with this serving size" option
  → Quantities remain scaled in meal plan + grocery list
```

---

## Flow 8: Rate and Track a Recipe

```
Recipe Detail view (after cooking)
  → Click "Mark as Made"
  → Star rating prompt (1–5 stars)
  → Optional: notes field ("Add more garlic next time")
  → Saves: rating, lastMadeAt, increments madeCount
  → "Made Again" history accessible from profile
```
