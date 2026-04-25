import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function verifyOwnership(listId: string, userId: string) {
  const list = await prisma.groceryList.findUnique({
    where: { id: listId },
    select: { userId: true },
  });
  if (!list) return { error: "List not found", status: 404 };
  if (list.userId !== userId) return { error: "Forbidden", status: 403 };
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, itemId } = await params;

  const ownershipError = await verifyOwnership(listId, userId);
  if (ownershipError) {
    return NextResponse.json(
      { error: ownershipError.error },
      { status: ownershipError.status }
    );
  }

  const body = await req.json();
  const { isChecked, name, quantity, unit } = body as {
    isChecked?: boolean;
    name?: string;
    quantity?: number | null;
    unit?: string | null;
  };

  const updateData: {
    isChecked?: boolean;
    name?: string;
    quantity?: number | null;
    unit?: string | null;
  } = {};

  if (typeof isChecked === "boolean") {
    updateData.isChecked = isChecked;
  }
  if (typeof name === "string" && name.trim()) {
    updateData.name = name.trim();
  }
  if (quantity !== undefined) {
    updateData.quantity = quantity;
  }
  if (unit !== undefined) {
    updateData.unit = unit;
  }

  const item = await prisma.groceryListItem.update({
    where: { id: itemId },
    data: updateData,
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, itemId } = await params;

  const ownershipError = await verifyOwnership(listId, userId);
  if (ownershipError) {
    return NextResponse.json(
      { error: ownershipError.error },
      { status: ownershipError.status }
    );
  }

  await prisma.groceryListItem.delete({
    where: { id: itemId },
  });

  return NextResponse.json({ ok: true });
}
