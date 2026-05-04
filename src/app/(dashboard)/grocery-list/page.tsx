export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import GroceryListClient from "@/components/grocery-list/grocery-list-client";
import type { PantryItem } from "@prisma/client";

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatShortDate(d: Date): string {
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  return `${month} ${day}`;
}

export default async function GroceryListPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const weekStart = getMondayOf(new Date());

  // Sunday of this week
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const currentWeekLabel = `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`;

  const [groceryList, mealPlan, pantryItems] = await Promise.all([
    prisma.groceryList.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.mealPlan.findFirst({
      where: {
        userId,
        weekStartDate: weekStart,
      },
    }),
    prisma.pantryItem.findMany({
      where: { userId },
      select: { name: true },
    }),
  ]);

  const pantryNames = pantryItems.map((p: Pick<PantryItem, "name">) => p.name);

  return (
    <GroceryListClient
      initialList={groceryList}
      currentWeekStart={weekStart.toISOString()}
      currentWeekLabel={currentWeekLabel}
      hasMealPlan={mealPlan !== null}
      pantryNames={pantryNames}
    />
  );
}
