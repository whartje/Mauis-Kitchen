import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estimateNutrition } from "@/lib/claude";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
    include: { ingredients: { orderBy: { sortOrder: "asc" } } },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nutrition = await estimateNutrition(recipe.ingredients, recipe.servings);

  const saved = await prisma.nutritionFact.upsert({
    where: { recipeId: id },
    create: {
      recipeId: id,
      calories: nutrition.calories ?? null,
      protein: nutrition.protein ?? null,
      carbs: nutrition.carbs ?? null,
      fat: nutrition.fat ?? null,
      fiber: nutrition.fiber ?? null,
      sugar: nutrition.sugar ?? null,
      sodium: nutrition.sodium ?? null,
      iron: nutrition.iron ?? null,
      servingSize: nutrition.servingSize ?? null,
      isEstimated: true,
    },
    update: {
      calories: nutrition.calories ?? null,
      protein: nutrition.protein ?? null,
      carbs: nutrition.carbs ?? null,
      fat: nutrition.fat ?? null,
      fiber: nutrition.fiber ?? null,
      sugar: nutrition.sugar ?? null,
      sodium: nutrition.sodium ?? null,
      iron: nutrition.iron ?? null,
      servingSize: nutrition.servingSize ?? null,
      isEstimated: true,
    },
  });

  return NextResponse.json({ nutrition: saved });
}
