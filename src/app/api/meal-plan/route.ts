import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

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
        include: { ingredients: { select: { name: true } } },
      },
    },
  },
} as const;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weekParam = req.nextUrl.searchParams.get("week");
  const weekStart = weekParam ? getMondayOf(weekParam) : currentMonday();

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

  return NextResponse.json(plan);
}
