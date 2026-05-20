import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// Never cache — health checks must reflect real-time state
export const revalidate = 0;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok", ts: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("[health] DB unreachable:", err);
    return NextResponse.json(
      { status: "error", db: "unreachable", ts: new Date().toISOString() },
      { status: 503 }
    );
  }
}
