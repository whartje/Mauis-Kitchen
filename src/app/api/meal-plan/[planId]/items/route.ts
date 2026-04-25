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

  const { recipeId, dayOfWeek, mealType } = await req.json();

  // One recipe per slot — remove any existing
  await prisma.mealPlanRecipe.deleteMany({
    where: { mealPlanId: planId, dayOfWeek, mealType },
  });

  const item = await prisma.mealPlanRecipe.create({
    data: { mealPlanId: planId, recipeId, dayOfWeek, mealType },
    include: {
      recipe: {
        include: { ingredients: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(item);
}
