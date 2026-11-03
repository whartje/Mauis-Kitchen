import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Google deletes OAuth clients that go 5 months without a Sign-in-with-Google
// flow or a refresh-token exchange. This forces that exchange for every
// connected account so the client never goes inactive.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function refreshCredential(cred: { userId: string; refreshToken: string }) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: cred.refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);

  const tokens = (await res.json()) as { access_token: string; expires_in: number };
  await prisma.googleCredential.update({
    where: { userId: cred.userId },
    data: {
      accessToken: tokens.access_token,
      expiresAt:   new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = await prisma.googleCredential.findMany({
    select: { userId: true, refreshToken: true },
  });

  const results = await Promise.allSettled(creds.map(refreshCredential));
  const refreshed = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({
    ok: true,
    total: creds.length,
    refreshed,
    failed: results.length - refreshed,
  });
}
