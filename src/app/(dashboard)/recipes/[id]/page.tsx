import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecipeDetailClient } from "@/components/recipes/recipe-detail-client";
import { getMealPlanIngredientSet, computeOverlapPercent } from "@/lib/meal-plan-overlap";
import type { Prisma } from "@prisma/client";

type FullRecipe = Prisma.RecipeGetPayload<{
  include: { ingredients: true; instructions: true; nutrition: true };
}>;

/** Converts minutes → ISO 8601 duration string (e.g. 30 → "PT30M") */
function toIsoDuration(minutes: number | null | undefined): string | undefined {
  if (!minutes) return undefined;
  return `PT${minutes}M`;
}

function buildRecipeJsonLd(recipe: FullRecipe) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.description ?? undefined,
    image: recipe.imageUrl ? [recipe.imageUrl] : undefined,
    author: { "@type": "Organization", name: "Maui's Kitchen" },
    datePublished: recipe.importedAt.toISOString().split("T")[0],
    prepTime: toIsoDuration(recipe.prepTime),
    cookTime: toIsoDuration(recipe.cookTime),
    totalTime: toIsoDuration(recipe.totalTime),
    recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
    recipeCategory: recipe.tags?.[0] ?? undefined,
    recipeIngredient: recipe.ingredients.map((i) => i.raw),
    recipeInstructions: recipe.instructions.map((s) => ({
      "@type": "HowToStep",
      text: s.text,
    })),
    nutrition: recipe.nutrition
      ? {
          "@type": "NutritionInformation",
          calories: recipe.nutrition.calories ? `${Math.round(recipe.nutrition.calories)} calories` : undefined,
          proteinContent: recipe.nutrition.protein ? `${recipe.nutrition.protein}g` : undefined,
          carbohydrateContent: recipe.nutrition.carbs ? `${recipe.nutrition.carbs}g` : undefined,
          fatContent: recipe.nutrition.fat ? `${recipe.nutrition.fat}g` : undefined,
          fiberContent: recipe.nutrition.fiber ? `${recipe.nutrition.fiber}g` : undefined,
          sugarContent: recipe.nutrition.sugar ? `${recipe.nutrition.sugar}g` : undefined,
          sodiumContent: recipe.nutrition.sodium ? `${recipe.nutrition.sodium}mg` : undefined,
        }
      : undefined,
    url: recipe.sourceUrl ?? undefined,
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [recipe, mealPlanSet, pantryItems] = await Promise.all([
    prisma.recipe.findFirst({
      where: { id, userId },
      include: {
        ingredients: { orderBy: { sortOrder: "asc" } },
        instructions: { orderBy: { stepNumber: "asc" } },
        nutrition: true,
      },
    }),
    getMealPlanIngredientSet(userId, prisma),
    prisma.pantryItem.findMany({
      where: { userId },
      select: { name: true },
    }),
  ]);

  if (!recipe) notFound();

  const overlapPercent = computeOverlapPercent(recipe.ingredients, mealPlanSet);
  const jsonLd = buildRecipeJsonLd(recipe);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RecipeDetailClient
        recipe={recipe}
        overlapPercent={overlapPercent}
        pantryNames={pantryItems.map((p) => p.name)}
      />
    </>
  );
}
