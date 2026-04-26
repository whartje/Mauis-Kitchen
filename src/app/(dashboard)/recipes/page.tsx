import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { RecipeLibraryClient } from "@/components/recipes/recipe-library-client";

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
};

export default async function RecipesPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const params = await searchParams;
  const { q, difficulty, favorite, sort = "newest", mealType, timeRange, foodGroup, collection } = params;

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
        { title: { contains: q, mode: "insensitive" as const } },
        { tags: { has: q } },
      ],
    }),
    ...(difficulty && { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }),
    ...(favorite === "true" && { isFavorite: true }),
    ...timeFilter,
    ...(mealType && MEAL_TYPE_TAGS[mealType] && {
      tags: { hasSome: MEAL_TYPE_TAGS[mealType] },
    }),
    ...(foodGroup && FOOD_GROUP_TAGS[foodGroup] && {
      tags: { hasSome: FOOD_GROUP_TAGS[foodGroup] },
    }),
    ...(collection && { collection }),
  };

  const orderBy =
    sort === "name"    ? { title: "asc" as const }
    : sort === "rating"  ? { rating: "desc" as const }
    : sort === "oldest"  ? { importedAt: "asc" as const }
    : sort === "fastest" ? { totalTime: "asc" as const }
    : { importedAt: "desc" as const };

  const [recipes, collectionsRaw] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy,
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
      },
    }),
    prisma.recipe.findMany({
      where: { userId, collection: { not: null } },
      select: { collection: true },
      distinct: ["collection"],
      orderBy: { collection: "asc" },
    }),
  ]);

  const cookbooks = collectionsRaw
    .map((r) => r.collection as string)
    .filter(Boolean);

  return <RecipeLibraryClient recipes={recipes} currentFilters={params} cookbooks={cookbooks} />;
}
