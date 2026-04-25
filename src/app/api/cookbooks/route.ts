import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.recipe.findMany({
    where: { userId, collection: { not: null } },
    select: { collection: true },
    distinct: ["collection"],
    orderBy: { collection: "asc" },
  });

  const cookbooks = rows.map((r) => r.collection as string);
  return NextResponse.json({ cookbooks });
}
