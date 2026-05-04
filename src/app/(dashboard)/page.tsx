import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

// Monday of the current UTC week
function currentWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const weekStart = currentWeekStart();

  const [recentRecipes, recipeCount, mealPlan, pantryItems] = await Promise.all([
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
    prisma.mealPlan.findFirst({
      where: { userId, weekStartDate: weekStart },
      include: {
        items: {
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                prepTime: true,
                cookTime: true,
                totalTime: true,
                servings: true,
                nutrition: true,
                ingredients: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.pantryItem.findMany({
      where: { userId },
      select: { name: true },
    }),
  ]);

  return (
    <DashboardClient
      recentRecipes={recentRecipes}
      recipeCount={recipeCount}
      weekStart={weekStart.toISOString()}
      mealPlanItems={mealPlan?.items ?? []}
      pantryNames={pantryItems.map((p) => p.name)}
    />
  );
}
