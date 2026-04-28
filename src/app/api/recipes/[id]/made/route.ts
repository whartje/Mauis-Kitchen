import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      madeCount: { increment: 1 },
      lastMadeAt: new Date(),
    },
    select: { madeCount: true, lastMadeAt: true },
  });

  return NextResponse.json(updated);
}
