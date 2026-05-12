import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ listId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "listId required" }, { status: 400 });
  }

  const creds = await prisma.alexaCredential.findUnique({ where: { userId } });
  if (!creds) return NextResponse.json({ error: "Alexa not connected" }, { status: 403 });

  await prisma.alexaCredential.update({
    where: { userId },
    data: { listId: parsed.data.listId },
  });

  return NextResponse.json({ ok: true });
}
