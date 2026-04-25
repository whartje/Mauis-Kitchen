# Maui's Kitchen — Screen Descriptions & Wireframes

All screens use: matte black/charcoal background, cream text, warm orange accents. Minimal chrome. No decorative illustrations beyond the cat icon in the logo.

---

## Screen 1: Dashboard / Home

**Purpose:** Orientation and quick actions.

**Layout:** Full-width dark page, two-column above fold.

**Left column (60%):**
- "This Week" meal plan card — shows 7-day grid with recipe thumbnails slotted in
- If empty: "No meal plan yet" + prominent "Plan This Week" CTA button

**Right column (40%):**
- "Recent Recipes" — 3 small recipe cards in a vertical stack
- "Quick Import" — text field + paste URL → import without opening full modal

**Bottom section:**
- "From Your Pantry" — shows 2–3 pantry-match suggestions if pantry has items
- Horizontal scroll of recipe cards with "missing X ingredients" badge

**Header:**
- Left: Maui's Kitchen logo (cat silhouette + wordmark)
- Right: avatar/account button, notification bell (future)

**Sidebar (desktop):**
- Dashboard
- Recipes
- Meal Plan
- Pantry
- Grocery List
- Settings

---

## Screen 2: Recipe Library

**Purpose:** Browse, search, and manage all saved recipes.

**Layout:** Full-width grid.

**Top bar:**
- Page title: "My Recipes"
- Search input (full text)
- Filter chips: All | Favorites | Easy | Vegan | Quick (< 30 min)
- Sort dropdown: Newest | A–Z | Highest Rated | Most Made
- "Import Recipe" button (primary, orange)

**Main content:**
- Masonry or uniform 3-column card grid (responsive)
- Each card:
  - Recipe image (top, 16:9)
  - Title
  - Tag chips (max 3 visible)
  - Star rating (if rated)
  - Prep + cook time
  - Favorite icon (heart, top-right corner)
  - "..." overflow: Edit, Delete, Add to Meal Plan

**Empty state:**
- Cat silhouette icon (subtle)
- "No recipes yet. Import your first one."
- "Import Recipe" button

---

## Screen 3: Import Recipe Modal

**Purpose:** Import via URL or photo.

**Layout:** Centered modal, 600px wide, dark card.

**Tab 1: From URL**
- Label: "Paste a recipe URL"
- Large text input, placeholder: "https://minimalistbaker.com/..."
- "Import" button
- Help text: "Works best with: Minimalist Baker, Oh She Glows, Lazy Cat Kitchen, and more"

**Tab 2: From Photo**
- Dashed upload zone (drag & drop or click)
- Icon + text: "Drop a screenshot or cookbook photo"
- File size limit: 10MB, JPG/PNG/WEBP
- Below zone: "Or take a photo" button (mobile)

**Loading state (either tab):**
- Progress indicator
- Animated status messages: "Fetching recipe..." → "Reading ingredients..." → "Saving..."

**Error state:**
- Red border on input
- Inline error message
- Secondary option: "Paste recipe text instead" expands textarea

---

## Screen 4: Recipe Detail

**Purpose:** View, scale, rate, and interact with a single recipe.

**Layout:** Two-column on desktop, single-column on mobile.

**Header:**
- Recipe image (full width, 400px tall, darkened gradient at bottom)
- Recipe title overlaid at bottom of image
- Tag chips
- Star rating (clickable)
- Source attribution: "From minimalistbaker.com ↗"

**Left column (40%):**
- Servings control: "− 4 servings +" (tap to change, triggers scaling)
- Prep time / Cook time / Total
- Difficulty badge
- Ingredient list
  - Each item: quantity + unit + name (scaled in real time)
  - Vague items (to taste): shown as-is in muted text
  - Ingredient category section headers (optional toggle)

**Right column (60%):**
- Instructions (numbered steps, large readable text)
- Each step: step number in orange circle, text body
- "Mark as Made" button (bottom of instructions)

**Floating action bar (bottom of screen on mobile):**
- "Add to Meal Plan" button
- "Send to Grocery List" button

**Nutrition panel (collapsible):**
- Calories, protein, carbs, fat, fiber
- Per-serving values

---

## Screen 5: Meal Plan Builder

**Purpose:** Compose a week's meals and find ingredient-efficient recipes.

**Layout:** Two-panel — recipe picker left, calendar right (desktop). Stacked on mobile.

**Left panel: Recipe Picker**
- Search recipes
- Filter: Locked | All
- Recipe list items: thumbnail, title, shared ingredient count badge
- Lock toggle on each selected recipe

**Ingredient Reuse Control (top of left panel):**
- Label: "Ingredient Reuse"
- Toggle: Low | Medium | High
- Tooltip: "Higher reuse = fewer unique ingredients to buy"

**Right panel: Meal Calendar**
- Mon–Sun rows
- Columns: Breakfast | Lunch | Dinner
- Each cell: drop zone for a recipe card
- Recipe in cell shows: thumbnail + title
- "X" to remove

**Bottom action bar:**
- "Suggest Recipes" button
- "Generate Grocery List" button (orange, primary)

**Suggestion drawer (slides up from bottom):**
- "Based on your current plan, these recipes share the most ingredients:"
- Horizontal scroll of recipe cards with shared ingredient count

---

## Screen 6: Pantry

**Purpose:** Track what you have, discover what you can make.

**Layout:** Two-section page.

**Top section: Pantry Input**
- Section title: "What's in your kitchen?"
- Three input options (tab row):
  - "Type" — text input, auto-suggest ingredient names
  - "Voice" — microphone button, live transcript display
  - "Photo" — upload zone
- Current pantry item list: chips/tags, removable with "×"

**Bottom section: Recipe Matches**
- Three columns (or tabbed on mobile):
  - "Ready to Cook" — 0 missing ingredients
  - "Almost" — 1–2 missing ingredients
  - "Partial" — 3+ missing, shown greyed out

- Each recipe card:
  - Thumbnail
  - Title
  - Missing ingredients pill (red): "Missing: lemon, tahini"
  - "Add to Meal Plan" button

---

## Screen 7: Grocery List

**Purpose:** Review, edit, and send the combined shopping list.

**Layout:** Single column, 700px max-width, centered.

**Top:**
- "Grocery List" title
- Generated date + source meal plan name
- "Send to Alexa" button (orange, prominent)
- "Copy List" button (secondary)

**List body:**
- Grouped by aisle category
- Section headers: "Produce", "Protein", "Pantry", "Dairy", "Spices"...
- Each item: checkbox | quantity + unit + name | edit icon | delete icon
- Inline editing: click item to edit quantity or name
- "Add item" button at bottom of each section

**Footer:**
- Item count: "14 items"
- "Clear checked items" button

**Alexa connection banner (if not connected):**
- Orange top banner: "Connect Alexa to send this list with one tap"
- "Connect Alexa" button

**Post-send state:**
- Green banner: "✓ 14 items sent to your Alexa shopping list"
- Timestamp

---

## Screen 8: Settings

**Purpose:** Account management and integrations.

**Sections:**
- **Account** — name, email, profile photo (via Clerk)
- **Alexa Integration** — connect/disconnect, test connection, default list name
- **Preferences**
  - Default servings (4)
  - Unit system (US Customary / Metric)
  - Default ingredient reuse level
- **Data**
  - Export all recipes (JSON)
  - Delete account

---

## Mobile Considerations

- Sidebar becomes bottom navigation tab bar
- Import modal becomes full-screen sheet
- Recipe detail stacks to single column
- Meal plan calendar scrolls horizontally
- Grocery list is optimized for one-handed use (large tap targets, swipe to check)
- Voice input button is prominently accessible in Pantry mode
