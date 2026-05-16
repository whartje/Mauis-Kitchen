import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; ingredientId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: recipeId, ingredientId } = await params;

  // Verify ownership via recipe
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const data = parsed.data;

  // Verify the ingredient belongs to this recipe (not just any recipe)
  const current = await prisma.ingredient.findFirst({ where: { id: ingredientId, recipeId } });
  if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const name = data.name ?? current.name;
  const quantity = "quantity" in data ? data.quantity : current.quantity;
  const unit = "unit" in data ? data.unit : current.unit;
  const raw = [quantity, unit, name].filter(Boolean).join(" ");

  const updated = await prisma.ingredient.update({
    where: { id: ingredientId },
    data: { ...data, raw },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; ingredientId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: recipeId, ingredientId } = await params;

  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Verify the ingredient belongs to this recipe (not just any recipe)
  const ingredient = await prisma.ingredient.findFirst({ where: { id: ingredientId, recipeId } });
  if (!ingredient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.ingredient.delete({ where: { id: ingredientId } });
  return NextResponse.json({ success: true });
}
