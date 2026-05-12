import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ALEXA_API = "https://api.amazonalexa.com";

async function getValidToken(userId: string): Promise<string> {
  const creds = await prisma.alexaCredential.findUnique({ where: { userId } });
  if (!creds) throw new Error("Alexa not connected");

  // Refresh if within 2 minutes of expiry
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

async function getListId(userId: string, accessToken: string): Promise<string> {
  const creds = await prisma.alexaCredential.findUnique({ where: { userId } });
  if (creds?.listId) return creds.listId;

  const res = await fetch(`${ALEXA_API}/v2/householdlists/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Alexa lists");
  const data = await res.json();
  const shopping = (data.lists ?? []).find(
    (l: { name: string; state: string }) =>
      l.name.toLowerCase().includes("shopping") && l.state === "active"
  );
  if (!shopping) throw new Error("No active Alexa shopping list found");

  await prisma.alexaCredential.update({ where: { userId }, data: { listId: shopping.listId } });
  return shopping.listId;
}

/** Strip leading quantities and units so "2 cups oats" → "oats" */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\d[\d./]*\s*(cups?|tbsp?|tablespoons?|teaspoons?|tsp|oz|lb|lbs|g|kg|ml|l|cloves?|bunches?|pieces?|cans?|bags?)?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type SyncMatch = {
  pantryId: string;
  pantryName: string;
  alexaItem: string;
};

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let accessToken: string;
  try {
    accessToken = await getValidToken(userId);
  } catch {
    return NextResponse.json({ error: "Alexa not connected" }, { status: 403 });
  }

  let listId: string;
  try {
    listId = await getListId(userId, accessToken);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to get list" }, { status: 502 });
  }

  // Fetch active (unchecked) Alexa shopping list items
  // Correct path: /v2/householdlists/{listId}/active  (items embedded in response body)
  const itemsRes = await fetch(`${ALEXA_API}/v2/householdlists/${listId}/active`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!itemsRes.ok) {
    return NextResponse.json({ error: "Failed to read Alexa shopping list" }, { status: 502 });
  }
  const itemsData = await itemsRes.json();
  const alexaItems: string[] = (itemsData.items ?? []).map(
    (i: { value: string }) => i.value as string
  );

  if (alexaItems.length === 0) {
    return NextResponse.json({ matches: [], alexaItems: [] });
  }

  // Compare against pantry
  const pantryItems = await prisma.pantryItem.findMany({ where: { userId } });

  const matches: SyncMatch[] = [];
  const seenPantryIds = new Set<string>();

  for (const alexa of alexaItems) {
    const alexaNorm = normalize(alexa);
    for (const pantry of pantryItems) {
      if (seenPantryIds.has(pantry.id)) continue;
      const pantryNorm = pantry.name.toLowerCase().trim();

      const hit =
        alexaNorm === pantryNorm ||
        alexaNorm.includes(pantryNorm) ||
        pantryNorm.includes(alexaNorm);

      if (hit) {
        matches.push({ pantryId: pantry.id, pantryName: pantry.name, alexaItem: alexa });
        seenPantryIds.add(pantry.id);
      }
    }
  }

  return NextResponse.json({ matches, alexaItems });
}
