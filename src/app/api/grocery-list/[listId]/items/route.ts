import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { IngredientCategory } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const list = await prisma.groceryList.findUnique({
    where: { id: listId },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (list.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    quantity,
    unit,
    category,
  } = body as {
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Get current max sortOrder
  const maxItem = await prisma.groceryListItem.findFirst({
    where: { groceryListId: listId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const nextSortOrder = (maxItem?.sortOrder ?? -1) + 1;

  const validCategory =
    category && Object.values(IngredientCategory).includes(category as IngredientCategory)
      ? (category as IngredientCategory)
      : IngredientCategory.OTHER;

  const item = await prisma.groceryListItem.create({
    data: {
      groceryListId: listId,
      name: name.trim(),
      quantity: quantity ?? null,
      unit: unit ?? null,
      raw: name.trim(),
      category: validCategory,
      isChecked: false,
      sortOrder: nextSortOrder,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
