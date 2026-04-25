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
