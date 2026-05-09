export type OverlapLevel = "Low" | "Medium" | "High";

export interface IngredientOverlap {
  level: OverlapLevel;
  score: number; // 0–1
  sharedIngredients: string[];
  totalUnique: number;
}

export function computeIngredientOverlap(
  recipes: Array<{ ingredients: Array<{ name: string }> }>
): IngredientOverlap {
  if (recipes.length < 2) {
    return { level: "Low", score: 0, sharedIngredients: [], totalUnique: 0 };
  }

  const normalize = (name: string) =>
    name.toLowerCase().replace(/\s+/g, " ").trim();

  // Count how many recipes each ingredient appears in
  const ingredientRecipeCounts = new Map<string, number>();

  for (const recipe of recipes) {
    const seen = new Set(recipe.ingredients.map((ing) => normalize(ing.name)));
    for (const ing of seen) {
      ingredientRecipeCounts.set(ing, (ingredientRecipeCounts.get(ing) ?? 0) + 1);
    }
  }

  const totalUnique = ingredientRecipeCounts.size;
  const shared = [...ingredientRecipeCounts.entries()].filter(([, count]) => count > 1);
  const sharedIngredients = shared.map(([name]) => name).sort();
  const score = totalUnique > 0 ? shared.length / totalUnique : 0;

  const level: OverlapLevel = score >= 0.35 ? "High" : score >= 0.15 ? "Medium" : "Low";

  return { level, score, sharedIngredients, totalUnique };
}

// ─── Fuzzy ingredient matching utilities ──────────────────────────────────────

const STOP_WORDS = new Set([
  // preparation / texture
  "fresh", "dried", "frozen", "cooked", "raw", "whole", "halved",
  "sliced", "chopped", "minced", "diced", "ground", "crushed", "grated",
  "peeled", "seeded", "shredded", "cubed", "thick", "thin", "finely",
  "roughly", "lightly", "boneless", "skinless", "extra", "virgin",
  "organic", "large", "small", "medium", "big", "roasted", "grilled",
  "steamed", "fried", "baked", "melted", "softened", "rinsed", "drained",
  "toasted", "sauteed",
  // units (singular + plural)
  "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon",
  "teaspoons", "tsp", "pound", "pounds", "ounce", "ounces", "oz",
  "lb", "lbs", "gram", "grams", "kilogram", "ml", "liter", "litre",
  "clove", "cloves", "head", "bunch", "can", "jar", "package", "packet",
  "stick", "slice", "slices", "piece", "pieces", "stalk", "stalks",
  "sprig", "sprigs", "pinch", "dash",
  // filler words
  "and", "or", "of", "the", "a", "an", "with", "to", "in", "for",
  "about", "approximately", "optional",
  // quality descriptors
  "low", "high", "reduced", "unsalted", "salted", "sweetened",
  "unsweetened", "plain", "unflavored", "fat", "sodium",
]);

/** Lightweight suffix stripper for the most common English plurals */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y"; // berries→berry
  if (word.endsWith("ves") && word.length > 4) return word.slice(0, -3) + "f"; // leaves→leaf
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);        // tomatoes→tomato
  if (word.endsWith("s")   && word.length > 3) return word.slice(0, -1);        // cloves→clove
  return word;
}

/**
 * Tokenise an ingredient name into meaningful root tokens.
 * Stop-words are removed and remaining words are lightly stemmed.
 */
export function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem)
    .filter((w) => w.length > 1);
}

/**
 * Build a flat token set from an array of ingredient / pantry names.
 * Used for O(1) look-up when scoring candidate recipes.
 */
export function buildTokenSet(names: string[]): Set<string> {
  const set = new Set<string>();
  for (const name of names) {
    for (const tok of tokenize(name)) set.add(tok);
  }
  return set;
}
