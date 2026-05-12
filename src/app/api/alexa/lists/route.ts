import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ALEXA_API = "https://api.amazonalexa.com";

async function getValidToken(userId: string): Promise<string> {
  const creds = await prisma.alexaCredential.findUnique({ where: { userId } });
  if (!creds) throw new Error("Alexa not connected");

  if (creds.expiresAt.getTime() - Date.now() <= 2 * 60 * 1000) {
    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refreshToken,
        client_id: process.env.AMAZON_CLIENT_ID!,
        client_secret: process.env.AMAZON_CLIENT_SECRET!,
      }),
    });
    if (!res.ok) throw new Error("Token refresh failed");
    const tokens = await res.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.alexaCredential.update({
      where: { userId },
      data: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt },
    });
    return tokens.access_token as string;
  }

  return creds.accessToken;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getValidToken(userId);
  } catch {
    return NextResponse.json({ error: "Alexa not connected" }, { status: 403 });
  }

  const res = await fetch(`${ALEXA_API}/v2/householdlists/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch Alexa lists" }, { status: 502 });
  }

  const data = await res.json();
  const lists: Array<{ listId: string; name: string; state: string }> = data.lists ?? [];

  // Return only active lists with their id and name
  const activeLists = lists
    .filter((l) => l.state === "active")
    .map((l) => ({ listId: l.listId, name: l.name }));

  // Also return the currently selected list ID
  const creds = await prisma.alexaCredential.findUnique({
    where: { userId },
    select: { listId: true },
  });

  return NextResponse.json({ lists: activeLists, selectedListId: creds?.listId ?? null });
}
