import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSubSummary,
  FREE_RECIPE_LIMIT,
  FREE_PHOTO_LIMIT,
  PRO_PHOTO_LIMIT,
} from "@/lib/subscription";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sub, recipeCount] = await Promise.all([
    getSubSummary(userId),
    prisma.recipe.count({ where: { userId } }),
  ]);

  // Reset photo counter client-side display if it's a new month
  const now = new Date();
  const resetAt = sub.photoImportResetAt;
  const isNewMonth =
    now.getUTCFullYear() !== resetAt.getUTCFullYear() ||
    now.getUTCMonth() !== resetAt.getUTCMonth();

  return NextResponse.json({
    plan: sub.plan,
    isPro: sub.isPro,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    recipeCount,
    recipeLimit: sub.isPro ? null : FREE_RECIPE_LIMIT,
    photoImportsThisMonth: isNewMonth ? 0 : sub.photoImportsThisMonth,
    photoLimit: sub.isPro ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT,
  });
}
