import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { scrapeRecipeFromUrl } from "@/lib/scraper";

const ScrapeSchema = z.object({
  url: z.string().url(),
  collection: z.string().min(1, "Cookbook / collection is required"),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const body = await request.json();
  const parsed = ScrapeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { url, collection } = parsed.data;

  const existing = await prisma.recipe.findFirst({
    where: { userId, sourceUrl: url },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "DUPLICATE", message: "You already have this recipe.", existingId: existing.id } },
      { status: 409 }
    );
  }

  let scrapeResult;
  try {
    scrapeResult = await scrapeRecipeFromUrl(url);
  } catch (err) {
    console.error("Scrape failed:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const isNotFound = msg.includes("404");
    const isBlocked = msg.includes("bot protection");
    return NextResponse.json(
      {
        error: {
          code: "SCRAPE_FAILED",
          message: isNotFound
            ? "That page wasn't found — double-check the URL is correct."
            : isBlocked
              ? msg
              : "This site doesn't use standard recipe markup. Try a URL from Minimalist Baker, Oh She Glows, The First Mess, or similar.",
        },
      },
      { status: 422 }
    );
  }

  const { recipe, sourceUrl, sourceName } = scrapeResult;

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
      imageUrl: recipe.imageUrl,
      sourceUrl,
      sourceName,
      collection,
      ingredients: {
        create: recipe.ingredients,
      },
      instructions: {
        create: recipe.instructions,
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
