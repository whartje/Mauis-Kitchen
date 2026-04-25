import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ALEXA_API = "https://api.amazonalexa.com";

async function refreshTokens(userId: string, refreshToken: string, expiresAt: Date) {
  // Refresh if within 2 minutes of expiry
  if (expiresAt.getTime() - Date.now() > 2 * 60 * 1000) return null;

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) throw new Error("Token refresh failed");

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.alexaCredential.update({
    where: { userId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: newExpiry,
    },
  });

  return tokens.access_token as string;
}

async function getShoppingListId(accessToken: string): Promise<string> {
  const res = await fetch(`${ALEXA_API}/v2/householdlists/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Alexa lists: ${res.status} ${text}`);
  }

  const data = await res.json();
  const lists: Array<{ listId: string; name: string; state: string }> = data.lists ?? [];

  // Alexa's default shopping list
  const shopping = lists.find(
    (l) => l.name.toLowerCase().includes("shopping") && l.state === "active"
  );

  if (!shopping) throw new Error("No active Alexa shopping list found");
  return shopping.listId;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId: groceryListId } = await req.json();
  if (!groceryListId) {
    return NextResponse.json({ error: "listId required" }, { status: 400 });
  }

  // Get Alexa credentials
  const creds = await prisma.alexaCredential.findUnique({ where: { userId } });
  if (!creds) {
    return NextResponse.json({ error: "Alexa not connected" }, { status: 403 });
  }

  // Refresh token if needed
  let accessToken = creds.accessToken;
  const refreshed = await refreshTokens(userId, creds.refreshToken, creds.expiresAt).catch(
    () => null
  );
  if (refreshed) accessToken = refreshed;

  // Get or resolve Alexa shopping list ID
  let alexaListId = creds.listId;
  if (!alexaListId) {
    alexaListId = await getShoppingListId(accessToken);
    await prisma.alexaCredential.update({
      where: { userId },
      data: { listId: alexaListId },
    });
  }

  // Fetch the grocery list items (unchecked only)
  const groceryList = await prisma.groceryList.findFirst({
    where: { id: groceryListId, userId },
    include: { items: { where: { isChecked: false }, orderBy: { sortOrder: "asc" } } },
  });

  if (!groceryList) {
    return NextResponse.json({ error: "Grocery list not found" }, { status: 404 });
  }

  if (groceryList.items.length === 0) {
    return NextResponse.json({ error: "No unchecked items to send" }, { status: 400 });
  }

  // Push each item to Alexa shopping list
  const pushUrl = `${ALEXA_API}/v2/householdlists/${alexaListId}/active/items`;
  const failures: string[] = [];

  await Promise.all(
    groceryList.items.map(async (item) => {
      // Format item value: "2 cups oats" or just "oats"
      const parts: string[] = [];
      if (item.quantity !== null) parts.push(String(item.quantity));
      if (item.unit) parts.push(item.unit);
      parts.push(item.name);
      const value = parts.join(" ");

      const res = await fetch(pushUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value, status: "active" }),
      });

      if (!res.ok) failures.push(item.name);
    })
  );

  // Mark the grocery list as sent
  await prisma.groceryList.update({
    where: { id: groceryListId },
    data: { sentToAlexa: true, alexaSentAt: new Date() },
  });

  if (failures.length > 0) {
    return NextResponse.json({
      ok: true,
      warning: `${failures.length} item(s) failed to send: ${failures.join(", ")}`,
    });
  }

  return NextResponse.json({ ok: true, count: groceryList.items.length });
}
