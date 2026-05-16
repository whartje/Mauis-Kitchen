import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function verifyOwner(planId: string, userId: string) {
  const plan = await prisma.mealPlan.findUnique({ where: { id: planId } });
  return plan?.userId === userId ? plan : null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, itemId } = await params;
  if (!(await verifyOwner(planId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Scope the delete to this plan so an attacker can't delete items in other plans
  const toDelete = await prisma.mealPlanRecipe.findFirst({ where: { id: itemId, mealPlanId: planId } });
  if (!toDelete) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mealPlanRecipe.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { planId, itemId } = await params;
  if (!(await verifyOwner(planId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { isLocked, servings } = body;

  const data: Record<string, unknown> = {};
  if (typeof isLocked === "boolean") data.isLocked = isLocked;
  if (typeof servings === "number" && servings > 0) data.servings = Math.round(servings);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Scope the update to this plan so an attacker can't modify items in other plans
  const toUpdate = await prisma.mealPlanRecipe.findFirst({ where: { id: itemId, mealPlanId: planId } });
  if (!toUpdate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.mealPlanRecipe.update({
    where: { id: itemId },
    data,
  });

  return NextResponse.json(item);
}
