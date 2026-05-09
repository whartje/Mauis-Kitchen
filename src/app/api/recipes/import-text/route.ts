export const maxDuration = 60; // Vercel Hobby plan max

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeRecipeFromText } from "@/lib/claude";
import { checkRecipeLimit } from "@/lib/subscription";

const Schema = z.object({
  text: z.string().min(10).max(20000),
  collection: z.string().min(1).optional().nullable(),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Recipe text is required (10–20,000 characters)." } },
      { status: 400 }
    );
  }

  const { text, collection } = parsed.data;

  // ── Tier gate: recipe count ──────────────────────────────────────────────
  const limit = await checkRecipeLimit(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RECIPE_LIMIT_REACHED",
          message: `You've reached the ${limit.limit}-recipe limit on the free plan. Upgrade to Pro for unlimited recipes.`,
          count: limit.count,
          limit: limit.limit,
        },
      },
      { status: 403 },
    );
  }

  let recipe;
  try {
    recipe = await normalizeRecipeFromText(text);
  } catch (err) {
    console.error("Text import error:", err);
    return NextResponse.json(
      {
        error: {
          code: "AI_ERROR",
          message:
            "Could not parse a recipe from this text. Make sure you've included a title, at least a few ingredients, and some instructions.",
        },
      },
      { status: 422 }
    );
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
      imageUrl: recipe.imageUrl ?? null,
      collection: collection ?? undefined,
      ingredients: {
        create: recipe.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          raw: ing.raw,
          notes: ing.notes ?? null,
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
