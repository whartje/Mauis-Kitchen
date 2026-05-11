import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CATEGORIES = ["PRODUCE", "FRUIT", "PROTEIN", "DAIRY", "GRAINS", "PANTRY", "SPICES", "FROZEN", "BEVERAGES", "CONDIMENTS", "OTHER"] as const;

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
  expiresAt: z.string().nullable().optional(), // ISO datetime string or null
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.pantryItem.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const data = parsed.data;
  const { expiresAt: expiresAtStr, ...rest } = data;
  const name = rest.name ?? existing.name;
  const quantity = "quantity" in rest ? rest.quantity : existing.quantity;
  const unit = "unit" in rest ? rest.unit : existing.unit;
  const raw = [quantity, unit, name].filter(Boolean).join(" ");

  // Convert ISO string → Date (or null) for Prisma
  const expiresAt =
    expiresAtStr !== undefined
      ? expiresAtStr
        ? new Date(expiresAtStr)
        : null
      : undefined;

  const updated = await prisma.pantryItem.update({
    where: { id },
    data: {
      ...rest,
      raw,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.pantryItem.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.pantryItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
