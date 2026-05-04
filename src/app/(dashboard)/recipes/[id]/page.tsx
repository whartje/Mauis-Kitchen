import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecipeDetailClient } from "@/components/recipes/recipe-detail-client";
import { getMealPlanIngredientSet, computeOverlapPercent } from "@/lib/meal-plan-overlap";

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

  return (
    <RecipeDetailClient
      recipe={recipe}
      overlapPercent={overlapPercent}
      pantryNames={pantryItems.map((p) => p.name)}
    />
  );
}
