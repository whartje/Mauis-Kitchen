import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

interface SpoonacularIngredient {
  id: number;
  name: string;
  amount: number;
  unit: string;
  original: string;
}

interface SpoonacularStep {
  number: number;
  step: string;
}

interface SpoonacularDetail {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  preparationMinutes: number | null;
  cookingMinutes: number | null;
  servings: number;
  sourceUrl: string;
  sourceName: string | null;
  spoonacularScore: number;
  aggregateLikes: number;
  diets: string[];
  dishTypes: string[];
  extendedIngredients: SpoonacularIngredient[];
  analyzedInstructions: Array<{ steps: SpoonacularStep[] }>;
  summary: string;
}

function inferDifficulty(minutes: number): "EASY" | "MEDIUM" | "HARD" {
  if (minutes <= 20) return "EASY";
  if (minutes <= 45) return "MEDIUM";
  return "HARD";
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SPOONACULAR_API_KEY not configured" }, { status: 503 });
  }

  const { spoonacularId } = await req.json();
  if (!spoonacularId) {
    return NextResponse.json({ error: "spoonacularId required" }, { status: 400 });
  }

  // Check if already imported (by sourceUrl prefix match isn't reliable, skip dupe check for simplicity)

  const res = await fetch(
    `https://api.spoonacular.com/recipes/${spoonacularId}/information?apiKey=${apiKey}&includeNutrition=false`
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch recipe details" }, { status: 502 });
  }

  const r: SpoonacularDetail = await res.json();

  const totalTime = r.readyInMinutes || null;
  const prepTime = r.preparationMinutes || null;
  const cookTime = r.cookingMinutes || null;
  const difficulty = inferDifficulty(r.readyInMinutes ?? 30);
  const rating = r.spoonacularScore ? parseFloat((r.spoonacularScore / 20).toFixed(1)) : null;

  const tags = [
    ...r.diets,
    ...r.dishTypes,
  ].map((t) => t.toLowerCase());

  const steps = r.analyzedInstructions?.[0]?.steps ?? [];

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      title: r.title,
      imageUrl: r.image || null,
      sourceUrl: r.sourceUrl || null,
      sourceName: r.sourceName || "Spoonacular",
      prepTime,
      cookTime,
      totalTime,
      servings: r.servings || 4,
      difficulty,
      rating,
      tags,
      ingredients: {
        create: r.extendedIngredients.map((ing, i) => ({
          name: ing.name,
          quantity: ing.amount || null,
          unit: ing.unit || null,
          raw: ing.original,
          sortOrder: i,
        })),
      },
      instructions: {
        create: steps.map((s) => ({
          stepNumber: s.number,
          text: s.step,
        })),
      },
    },
  });

  return NextResponse.json({ recipeId: recipe.id });
}
