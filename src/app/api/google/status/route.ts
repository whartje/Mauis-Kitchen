import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await prisma.googleCredential.findUnique({
    where: { userId },
    select: { createdAt: true },
  });

  return NextResponse.json({ connected: !!creds, connectedAt: creds?.createdAt ?? null });
}
