import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CreateSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
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

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { name, quantity, unit } = parsed.data;
  const raw = [quantity, unit, name].filter(Boolean).join(" ");

  const item = await prisma.pantryItem.create({
    data: { userId, name, quantity: quantity ?? null, unit: unit || null, raw },
  });

  return NextResponse.json(item, { status: 201 });
}
