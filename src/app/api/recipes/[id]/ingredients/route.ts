import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: recipeId } = await params;
  const existing = await prisma.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { name, quantity, unit, notes } = parsed.data;

  // Find the next sort order
  const last = await prisma.ingredient.findFirst({
    where: { recipeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  // Build raw string
  const raw = [quantity, unit, name].filter(Boolean).join(" ");

  const ingredient = await prisma.ingredient.create({
    data: { recipeId, name, quantity: quantity ?? null, unit: unit || null, notes: notes || null, raw, sortOrder },
  });

  return NextResponse.json(ingredient, { status: 201 });
}
