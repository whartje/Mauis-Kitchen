import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId } = await params;
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { recipeId, dayOfWeek, mealType, servings } = await req.json();

  // Verify the recipe belongs to this user so they can't reference other users' recipes
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const item = await prisma.mealPlanRecipe.create({
    data: {
      mealPlanId: planId,
      recipeId,
      dayOfWeek,
      mealType,
      ...(typeof servings === "number" && servings > 0 ? { servings } : {}),
    },
    include: {
      recipe: {
        include: { ingredients: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(item);
}
