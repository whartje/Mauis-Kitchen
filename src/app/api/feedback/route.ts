import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  message: z.string().min(5).max(2000),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Message must be between 5 and 2000 characters." },
      { status: 400 }
    );
  }

  await prisma.feedback.create({
    data: { userId, message: parsed.data.message },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
