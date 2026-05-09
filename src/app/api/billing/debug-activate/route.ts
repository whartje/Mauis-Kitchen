/**
 * TEMPORARY DEBUG ROUTE — delete this file after confirming Pro works.
 * GET /api/billing/debug-activate
 * Sets the current authenticated user to Pro in the DB.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({ success: true, plan: sub.plan });
}
