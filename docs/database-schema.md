# Maui's Kitchen — Database Schema

## Entity Relationship Summary

```
User (via Clerk)
  ├── Recipe[]
  │     ├── Ingredient[]
  │     ├── Instruction[]
  │     └── NutritionFact
  ├── MealPlan[]
  │     └── MealPlanRecipe[]
  ├── PantryItem[]
  ├── GroceryList[]
  │     └── GroceryListItem[]
  └── AlexaCredential
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// RECIPES
// ─────────────────────────────────────────────

model Recipe {
  id          String   @id @default(cuid())
  userId      String                           // Clerk user ID
  title       String
  description String?
  servings    Int      @default(4)
  prepTime    Int?                             // minutes
  cookTime    Int?                             // minutes
  totalTime   Int?                             // minutes
  difficulty  Difficulty @default(MEDIUM)
  rating      Float?                           // 1.0 – 5.0
  imageUrl    String?
  sourceUrl   String?
  sourceName  String?
  isFavorite  Boolean  @default(false)
  madeCount   Int      @default(0)
  lastMadeAt  DateTime?
  importedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tags        String[]

  ingredients  Ingredient[]
  instructions Instruction[]
  nutrition    NutritionFact?
  mealPlanItems MealPlanRecipe[]

  @@index([userId])
  @@index([userId, isFavorite])
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

model Ingredient {
  id        String   @id @default(cuid())
  recipeId  String
  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  name      String                           // normalized: "chicken breast"
  quantity  Float?                           // null for "to taste"
  unit      String?                          // "lb", "cup", "tbsp", null
  raw       String                           // original text: "1 lb boneless chicken breast"
  notes     String?                          // "to taste", "optional", "finely chopped"
  category  IngredientCategory @default(OTHER)
  sortOrder Int      @default(0)

  @@index([recipeId])
  @@index([name])                            // for ingredient overlap queries
}

enum IngredientCategory {
  PRODUCE
  PROTEIN
  DAIRY
  GRAINS
  PANTRY
  SPICES
  FROZEN
  BEVERAGES
  OTHER
}

model Instruction {
  id        String  @id @default(cuid())
  recipeId  String
  recipe    Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  stepNumber Int
  text       String

  @@index([recipeId])
}

model NutritionFact {
  id          String  @id @default(cuid())
  recipeId    String  @unique
  recipe      Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  calories    Float?
  protein     Float?  // grams
  carbs       Float?  // grams
  fat         Float?  // grams
  fiber       Float?  // grams
  sugar       Float?  // grams
  sodium      Float?  // mg
  servingSize String? // "1 cup", "1 bowl"
}

// ─────────────────────────────────────────────
// MEAL PLANS
// ─────────────────────────────────────────────

model MealPlan {
  id          String   @id @default(cuid())
  userId      String
  name        String   @default("This Week")
  weekStartDate DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       MealPlanRecipe[]

  @@index([userId])
  @@index([userId, weekStartDate])
}

model MealPlanRecipe {
  id         String   @id @default(cuid())
  mealPlanId String
  mealPlan   MealPlan @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  recipeId   String
  recipe     Recipe   @relation(fields: [recipeId], references: [id])

  dayOfWeek  Int?                             // 0=Mon, 6=Sun, null=unscheduled
  mealType   MealType @default(DINNER)
  servings   Int      @default(4)             // may differ from recipe default
  isLocked   Boolean  @default(false)

  @@unique([mealPlanId, recipeId, dayOfWeek, mealType])
  @@index([mealPlanId])
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
  SNACK
}

// ─────────────────────────────────────────────
// PANTRY
// ─────────────────────────────────────────────

model PantryItem {
  id        String   @id @default(cuid())
  userId    String
  name      String                           // normalized ingredient name
  quantity  Float?
  unit      String?
  raw       String                           // how user entered it
  category  IngredientCategory @default(OTHER)
  addedAt   DateTime @default(now())
  expiresAt DateTime?

  @@index([userId])
  @@index([userId, name])
}

// ─────────────────────────────────────────────
// GROCERY LISTS
// ─────────────────────────────────────────────

model GroceryList {
  id          String   @id @default(cuid())
  userId      String
  mealPlanId  String?                        // optional link to meal plan
  name        String   @default("Grocery List")
  createdAt   DateTime @default(now())
  sentToAlexa Boolean  @default(false)
  alexaSentAt DateTime?

  items       GroceryListItem[]

  @@index([userId])
}

model GroceryListItem {
  id            String      @id @default(cuid())
  groceryListId String
  groceryList   GroceryList @relation(fields: [groceryListId], references: [id], onDelete: Cascade)

  name          String
  quantity      Float?
  unit          String?
  raw           String                       // display string: "1.5 lb chicken breast"
  category      IngredientCategory @default(OTHER)
  isChecked     Boolean     @default(false)
  sortOrder     Int         @default(0)

  @@index([groceryListId])
}

// ─────────────────────────────────────────────
// ALEXA INTEGRATION
// ─────────────────────────────────────────────

model AlexaCredential {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String                        // encrypted
  refreshToken String                        // encrypted
  expiresAt    DateTime
  listId       String?                       // user's default Alexa shopping list ID
  updatedAt    DateTime @updatedAt
}
```

---

## Key Design Decisions

### Why `raw` on Ingredient and GroceryListItem?
The `raw` field preserves the original text exactly as written ("salt to taste", "1 can diced tomatoes"). This is displayed in the UI while the structured `quantity`/`unit`/`name` fields are used for computation (scaling, combining).

### Why `userId` as String (not FK)?
Clerk manages users externally. We store the Clerk `userId` string directly rather than maintaining a local users table. This avoids sync complexity.

### Ingredient Category
Used to group the grocery list by aisle. The Claude normalization prompt assigns category automatically. Users can override manually.

### Scaling at Display Time
Recipe servings are stored at base (recipe default). The `MealPlanRecipe.servings` field tracks what the user intends to cook. Scaling math happens at query time, not at storage time — this avoids storing scaled duplicates.

---

## Indexes

Critical query patterns and their indexes:
- `Recipe` by `userId` — recipe library
- `Recipe` by `userId + isFavorite` — favorites tab
- `Ingredient` by `name` — ingredient overlap detection for meal plan suggestions
- `PantryItem` by `userId + name` — pantry matching
- `MealPlan` by `userId + weekStartDate` — current week lookup
