export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import GroceryListClient from "@/components/grocery-list/grocery-list-client";
import type { PantryItem } from "@prisma/client";

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

export default async function GroceryListPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { week } = await searchParams;
  const weekStart = week ? getMondayOf(week) : currentMonday();
  const thisMonday = currentMonday();

  // Find the meal plan for the selected week
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { userId, weekStartDate: weekStart },
  });

  // Find the grocery list linked to that meal plan (if it exists)
  const [groceryList, pantryItems] = await Promise.all([
    mealPlan
      ? prisma.groceryList.findFirst({
          where: { userId, mealPlanId: mealPlan.id },
          orderBy: { createdAt: "desc" },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve(null),
    prisma.pantryItem.findMany({
      where: { userId },
      select: { name: true },
    }),
  ]);

  const pantryNames = pantryItems.map((p: Pick<PantryItem, "name">) => p.name);

  return (
    <GroceryListClient
      initialList={groceryList}
      weekStart={weekStart.toISOString()}
      thisWeekStart={thisMonday.toISOString()}
      hasMealPlan={mealPlan !== null}
      pantryNames={pantryNames}
    />
  );
}
