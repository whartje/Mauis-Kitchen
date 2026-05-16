import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeSpecificRecipeFromImage } from "@/lib/claude";
import { checkRecipeLimit } from "@/lib/subscription";

const SelectSchema = z.object({
  imageUrl: z.string().url(),
  selectedTitle: z.string().min(1),
  collection: z.string().optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  // Check recipe limit before processing the image
  const limit = await checkRecipeLimit(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RECIPE_LIMIT_REACHED", message: `You've reached the ${limit.limit}-recipe limit. Upgrade to Pro for unlimited recipes.` } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = SelectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { imageUrl, selectedTitle, collection } = parsed.data;

  let recipe;
  try {
    recipe = await normalizeSpecificRecipeFromImage(imageUrl, selectedTitle);
  } catch (err) {
    console.error("Claude Vision error:", err);
    return NextResponse.json({ error: { code: "AI_ERROR" } }, { status: 422 });
  }

  const saved = await prisma.recipe.create({
    data: {
      userId,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      difficulty: recipe.difficulty,
      tags: recipe.tags,
      imageUrl,
      collection: collection ?? undefined,
      ingredients: {
        create: recipe.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          raw: ing.raw,
          notes: ing.notes,
          category: ing.category,
          sortOrder: idx,
        })),
      },
      instructions: {
        create: recipe.instructions.map((step) => ({
          stepNumber: step.stepNumber,
          text: step.text,
        })),
      },
    },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      instructions: { orderBy: { stepNumber: "asc" } },
      nutrition: true,
    },
  });

  return NextResponse.json(saved, { status: 201 });
}
