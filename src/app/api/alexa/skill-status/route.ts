import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const link = await prisma.alexaSkillLink.findUnique({
    where: { userId },
    select: { listName: true, createdAt: true },
  });

  return NextResponse.json({
    linked: !!link,
    listName: link?.listName ?? "Grocery List",
    linkedAt: link?.createdAt?.toISOString() ?? null,
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listName } = (await req.json()) as { listName?: string };
  if (!listName?.trim()) return NextResponse.json({ error: "listName required" }, { status: 400 });

  await prisma.alexaSkillLink.update({
    where: { userId },
    data: { listName: listName.trim() },
  });

  return NextResponse.json({ ok: true });
}
