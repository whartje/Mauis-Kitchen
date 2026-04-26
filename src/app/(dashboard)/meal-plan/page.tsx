import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { MealPlanClient } from "@/components/meal-plan/meal-plan-client";

interface Props {
  searchParams: Promise<{ week?: string }>;
}

function getMondayOf(dateStr: string): Date {
  const date = new Date(dateStr + "T12:00:00Z");
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function currentMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

const itemsInclude = {
  items: {
    include: {
      recipe: {
        include: {
          ingredients: { select: { name: true } },
          nutrition: true,
        },
      },
    },
  },
} as const;

export default async function MealPlanPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { week } = await searchParams;
  const weekStart = week ? getMondayOf(week) : currentMonday();

  let plan = await prisma.mealPlan.findFirst({
    where: { userId, weekStartDate: weekStart },
    include: itemsInclude,
  });

  if (!plan) {
    plan = await prisma.mealPlan.create({
      data: { userId, weekStartDate: weekStart },
      include: itemsInclude,
    });
  }

  const recipes = await prisma.recipe.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      totalTime: true,
      tags: true,
      ingredients: { select: { name: true } },
    },
    orderBy: { title: "asc" },
  });

  return (
    <MealPlanClient
      key={weekStart.toISOString()}
      plan={plan as Parameters<typeof MealPlanClient>[0]["plan"]}
      recipes={recipes}
      weekStart={weekStart.toISOString()}
    />
  );
}
