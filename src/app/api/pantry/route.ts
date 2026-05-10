import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CATEGORIES = ["PRODUCE", "FRUIT", "PROTEIN", "DAIRY", "GRAINS", "PANTRY", "SPICES", "FROZEN", "BEVERAGES", "OTHER"] as const;

const CreateSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json({ items });
}

/** DELETE /api/pantry — bulk-delete pantry items.
 *  Body: { ids?: string[]; category?: string }
 *  - ids: delete only those IDs (must belong to the user)
 *  - category: delete all items in that category
 *  - neither: delete ALL items for the user
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let ids: string[] | undefined;
  let category: string | undefined;
  try {
    const body = await request.json();
    ids = body.ids;
    category = body.category;
  } catch {
    // empty body is fine — delete all
  }

  await prisma.pantryItem.deleteMany({
    where: {
      userId,
      ...(ids      ? { id: { in: ids } } : {}),
      ...(category ? { category: category as typeof CATEGORIES[number] } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { name, quantity, unit, category } = parsed.data;
  const raw = [quantity, unit, name].filter(Boolean).join(" ");

  const item = await prisma.pantryItem.create({
    data: { userId, name, quantity: quantity ?? null, unit: unit || null, raw, ...(category ? { category } : {}) },
  });

  return NextResponse.json(item, { status: 201 });
}
