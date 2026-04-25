import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [recentRecipes, recipeCount] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId },
      orderBy: { importedAt: "desc" },
      take: 6,
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
      },
    }),
    prisma.recipe.count({ where: { userId } }),
  ]);

  return <DashboardClient recentRecipes={recentRecipes} recipeCount={recipeCount} />;
}
