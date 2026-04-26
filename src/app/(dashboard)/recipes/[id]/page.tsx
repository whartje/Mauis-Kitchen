import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecipeDetailClient } from "@/components/recipes/recipe-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      instructions: { orderBy: { stepNumber: "asc" } },
      nutrition: true,
    },
  });

  if (!recipe) notFound();

  return <RecipeDetailClient recipe={{ ...recipe, notes: recipe.notes ?? null }} />;
}
