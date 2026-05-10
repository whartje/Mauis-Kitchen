import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { RecipeLibraryClient } from "@/components/recipes/recipe-library-client";
import { getMealPlanIngredientSet, computeOverlapPercent, computeFuzzyOverlapPercent } from "@/lib/meal-plan-overlap";
import { buildTokenSet } from "@/lib/overlap";

interface Props {
  searchParams: Promise<{
    q?: string;
    difficulty?: string;
    favorite?: string;
    sort?: string;
    mealType?: string;
    timeRange?: string;
    foodGroup?: string;
    collection?: string;
    protein?: string;
    ingredient?: string;
  }>;
}

const FOOD_GROUP_TAGS: Record<string, string[]> = {
  vegan:       ["vegan", "plant-based", "plant based"],
  vegetarian:  ["vegetarian"],
  "gluten-free": ["gluten-free", "gluten free"],
  "dairy-free":  ["dairy-free", "dairy free"],
  "high-protein": ["high protein", "high-protein"],
  paleo:       ["paleo"],
  keto:        ["keto", "ketogenic", "low carb", "low-carb"],
};

const MEAL_TYPE_TAGS: Record<string, string[]> = {
  breakfast: ["breakfast", "brunch"],
  lunch:     ["lunch", "salad", "soup", "sandwich", "wrap"],
  dinner:    ["dinner", "main course", "main dish", "entrée", "entree"],
  snack:     ["snack", "appetizer", "side", "small plates"],
  dessert:   ["dessert", "baking", "sweet", "cake", "cookies", "pastry", "pudding"],
  soup:      ["soup", "stew", "chowder", "bisque", "chili", "broth", "chilli"],
  salad:     ["salad", "slaw"],
  sauce:     ["sauce", "dressing", "condiment", "dip", "marinade", "gravy", "pesto", "salsa", "vinaigrette"],
};

// Title keywords that positively identify a meal type (catches recipes with no/wrong tags)
const MEAL_TYPE_TITLE_KEYWORDS: Record<string, string[]> = {
  breakfast: [
    "pancake", "waffle", "oatmeal", "overnight oat", "granola", "frittata",
    "omelet", "omelette", "french toast", "crepe", "smoothie bowl",
    "eggs benedict", "shakshuka", "breakfast burrito", "breakfast",
  ],
  lunch:  [],
  dinner: [],
  snack:  [],
  dessert: [
    "cake", "cookie", "cookies", "brownie", "tart", "muffin", "cheesecake",
    "cupcake", "sorbet", "ice cream", "tiramisu", "macaron", "fudge",
    "parfait", "cobbler", "biscotti", "gelato", "cannoli", "churro",
  ],
  soup: [
    "soup", "stew", "chowder", "bisque", "chili", "chilli", "ramen", "pho",
    "minestrone", "gazpacho", "gumbo", "potage", "broth",
  ],
  salad: ["salad", "slaw", "coleslaw"],
  sauce: [
    "sauce", "dressing", "marinade", "gravy", "pesto", "salsa", "vinaigrette",
    "aioli", "hummus", "dip", "tahini", "chimichurri", "romesco",
  ],
};

// Title keywords that disqualify a recipe from a meal-type filter.
// Prevents generic tags like "main dish" on breakfast recipes from
// polluting the dinner results.
const MEAL_TYPE_TITLE_EXCLUSIONS: Record<string, string[]> = {
  dinner: [
    "pancake", "waffle", "oatmeal", "overnight oat", "granola", "frittata",
    "omelet", "omelette", "french toast", "crepe", "smoothie bowl",
  ],
  breakfast: [],
  lunch:     [],
  snack:     [],
  dessert:   [],
  soup:      [],
  salad:     [],
  sauce:     [],
};

/** Build a Prisma sub-condition for meal-type filtering that combines
 *  tag matching, title-keyword inclusion, and title-based exclusion. */
function buildMealTypeWhere(mealType: string) {
  const matchTags   = MEAL_TYPE_TAGS[mealType]            ?? [];
  const matchTitles = MEAL_TYPE_TITLE_KEYWORDS[mealType]  ?? [];
  const excTitles   = MEAL_TYPE_TITLE_EXCLUSIONS[mealType] ?? [];

  return {
    AND: [
      // Must match via a tag OR a title keyword for this meal type
      {
        OR: [
          ...(matchTags.length   ? [{ tags: { hasSome: matchTags } }] : []),
          ...matchTitles.map((kw) => ({
            title: { contains: kw, mode: "insensitive" as const },
          })),
        ],
      },
      // Must NOT contain title keywords that indicate a conflicting meal type
      ...excTitles.map((kw) => ({
        NOT: { title: { contains: kw, mode: "insensitive" as const } },
      })),
    ],
  };
}

export default async function RecipesPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const params = await searchParams;
  const { q, difficulty, favorite, sort = "newest", mealType, timeRange, foodGroup, collection, protein, ingredient } = params;

  // Build time filter
  let timeFilter = {};
  if (timeRange === "under20") timeFilter = { totalTime: { lte: 20 } };
  else if (timeRange === "20to30") timeFilter = { totalTime: { gt: 20, lte: 30 } };
  else if (timeRange === "30to45") timeFilter = { totalTime: { gt: 30, lte: 45 } };
  else if (timeRange === "45plus") timeFilter = { totalTime: { gt: 45 } };

  const where = {
    userId,
    ...(q && {
      OR: [
        { title:      { contains: q, mode: "insensitive" as const } },
        { sourceName: { contains: q, mode: "insensitive" as const } },
        { tags: { has: q.toLowerCase() } },
        { ingredients: { some: { name: { contains: q, mode: "insensitive" as const } } } },
      ],
    }),
    ...(difficulty && { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }),
    ...(favorite === "true" && { isFavorite: true }),
    ...timeFilter,
    ...(mealType && MEAL_TYPE_TAGS[mealType] && buildMealTypeWhere(mealType)),
    ...(foodGroup && FOOD_GROUP_TAGS[foodGroup] && {
      tags: { hasSome: FOOD_GROUP_TAGS[foodGroup] },
    }),
    ...(collection && { collection }),
    ...(protein === "high"   && { nutrition: { protein: { gt: 10 } } }),
    ...(protein === "medium" && { nutrition: { protein: { gte: 5, lte: 10 } } }),
    ...(protein === "low"    && { nutrition: { protein: { lt: 5 } } }),
    ...(ingredient && {
      ingredients: {
        some: {
          OR: [
            { name: { contains: ingredient, mode: "insensitive" as const } },
            { raw:  { contains: ingredient, mode: "insensitive" as const } },
          ],
        },
      },
    }),
  };

  // Overlap sorts are computed in JS after fetching — fall back to "newest" for DB orderBy
  const isOverlapSort = sort === "plan_overlap" || sort === "pantry_overlap";
  const orderBy =
    sort === "name"         ? { title: "asc" as const }
    : sort === "rating"     ? { rating: "desc" as const }
    : sort === "oldest"     ? { importedAt: "asc" as const }
    : sort === "fastest"    ? { totalTime: "asc" as const }
    : sort === "most_made"  ? { madeCount: "desc" as const }
    : sort === "last_made"  ? { lastMadeAt: "desc" as const }
    : { importedAt: "desc" as const }; // default (newest) + overlap sorts

  const [recipes, collectionsRaw, mealPlanSet, pantryItemsRaw] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: isOverlapSort ? { importedAt: "desc" } : orderBy,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        prepTime: true,
        cookTime: true,
        totalTime: true,
        difficulty: true,
        rating: true,
        isFavorite: true,
        tags: true,
        servings: true,
        importedAt: true,
        sourceName: true,
        collection: true,
        madeCount: true,
        lastMadeAt: true,
        ingredients: { select: { name: true } },
      },
    }),
    prisma.recipe.findMany({
      where: { userId, collection: { not: null } },
      select: { collection: true },
      distinct: ["collection"],
      orderBy: { collection: "asc" },
    }),
    getMealPlanIngredientSet(userId, prisma),
    prisma.pantryItem.findMany({ where: { userId }, select: { name: true } }),
  ]);

  const cookbooks = collectionsRaw
    .map((r) => r.collection as string)
    .filter(Boolean);

  // Build pantry token set for fuzzy matching
  const pantryTokenSet = buildTokenSet(pantryItemsRaw.map((p) => p.name));

  // Compute overlap % per recipe for both plan and pantry
  const overlapMap: Record<string, number | null> = {};
  const pantryOverlapMap: Record<string, number | null> = {};
  for (const r of recipes) {
    overlapMap[r.id] = computeOverlapPercent(r.ingredients, mealPlanSet);
    pantryOverlapMap[r.id] = computeFuzzyOverlapPercent(r.ingredients, pantryTokenSet);
  }

  // Apply JS sort for overlap-based sorts (can't do this in SQL)
  if (sort === "plan_overlap") {
    recipes.sort((a, b) => (overlapMap[b.id] ?? -1) - (overlapMap[a.id] ?? -1));
  } else if (sort === "pantry_overlap") {
    recipes.sort((a, b) => (pantryOverlapMap[b.id] ?? -1) - (pantryOverlapMap[a.id] ?? -1));
  }

  return (
    <RecipeLibraryClient
      recipes={recipes}
      currentFilters={params}
      cookbooks={cookbooks}
      overlapMap={overlapMap}
      pantryOverlapMap={pantryOverlapMap}
    />
  );
}
