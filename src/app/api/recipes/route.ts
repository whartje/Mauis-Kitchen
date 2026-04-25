import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");
  const difficulty = searchParams.get("difficulty");
  const favorite = searchParams.get("favorite");
  const sort = searchParams.get("sort") ?? "newest";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const where = {
    userId,
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { tags: { has: q } },
      ],
    }),
    ...(tag && { tags: { has: tag } }),
    ...(difficulty && { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" }),
    ...(favorite === "true" && { isFavorite: true }),
  };

  const orderBy =
    sort === "name"
      ? { title: "asc" as const }
      : sort === "rating"
        ? { rating: "desc" as const }
        : sort === "oldest"
          ? { importedAt: "asc" as const }
          : { importedAt: "desc" as const };

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      prepTime: true,
      cookTime: true,
      difficulty: true,
      rating: true,
      isFavorite: true,
      tags: true,
      servings: true,
      importedAt: true,
      sourceName: true,
    },
  });

  return NextResponse.json({ recipes });
}
