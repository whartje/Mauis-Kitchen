const normalize = (name: string) =>
  name.toLowerCase().replace(/\s+/g, " ").trim();

/** Fetch the current week's meal plan ingredient names for a user. */
export async function getMealPlanIngredientSet(
  userId: string,
  prisma: import("@prisma/client").PrismaClient
): Promise<Set<string>> {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);

  const plan = await prisma.mealPlan.findFirst({
    where: { userId, weekStartDate: monday },
    include: {
      items: {
        include: {
          recipe: { include: { ingredients: { select: { name: true } } } },
        },
      },
    },
  });

  const set = new Set<string>();
  for (const item of plan?.items ?? []) {
    for (const ing of item.recipe.ingredients) {
      set.add(normalize(ing.name));
    }
  }
  return set;
}

/** 0–100 overlap %, or null if recipe has no ingredients. */
export function computeOverlapPercent(
  recipeIngredients: { name: string }[],
  mealPlanSet: Set<string>
): number | null {
  if (recipeIngredients.length === 0 || mealPlanSet.size === 0) return null;
  const matches = recipeIngredients.filter((i) =>
    mealPlanSet.has(normalize(i.name))
  ).length;
  return Math.round((matches / recipeIngredients.length) * 100);
}

/** Tailwind color class based on overlap %. */
export function overlapColor(pct: number): string {
  if (pct >= 50) return "text-green-400";
  if (pct >= 10) return "text-yellow-400";
  return "text-red-400";
}
