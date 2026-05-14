import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";
const LIST_NAME = "Maui's Kitchen";

// ── Token management ──────────────────────────────────────────────────────────

async function getValidToken(userId: string): Promise<string> {
  const creds = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!creds) throw new Error("Google not connected");

  // Refresh if within 2 minutes of expiry
  if (creds.expiresAt.getTime() - Date.now() <= 2 * 60 * 1000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: creds.refreshToken,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    });
    if (!res.ok) throw new Error("Token refresh failed");
    const tokens = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.googleCredential.update({
      where: { userId },
      data:  { accessToken: tokens.access_token, expiresAt },
    });
    return tokens.access_token;
  }

  return creds.accessToken;
}

// ── Task list helpers ─────────────────────────────────────────────────────────

async function getOrCreateTaskList(userId: string, token: string): Promise<string> {
  const creds = await prisma.googleCredential.findUnique({ where: { userId } });

  // Return cached list ID if we have one
  if (creds?.tasksListId) {
    // Verify it still exists
    const check = await fetch(`${TASKS_API}/users/@me/lists/${creds.tasksListId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (check.ok) return creds.tasksListId;
  }

  // Fetch all task lists and find ours
  const listsRes = await fetch(`${TASKS_API}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listsRes.ok) throw new Error("Failed to fetch Google Task lists");
  const listsData = await listsRes.json() as { items?: { id: string; title: string }[] };

  const existing = (listsData.items ?? []).find((l) => l.title === LIST_NAME);
  if (existing) {
    await prisma.googleCredential.update({ where: { userId }, data: { tasksListId: existing.id } });
    return existing.id;
  }

  // Create the list
  const createRes = await fetch(`${TASKS_API}/users/@me/lists`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ title: LIST_NAME }),
  });
  if (!createRes.ok) throw new Error("Failed to create Google Task list");
  const newList = await createRes.json() as { id: string };
  await prisma.googleCredential.update({ where: { userId }, data: { tasksListId: newList.id } });
  return newList.id;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let token: string;
  try {
    token = await getValidToken(userId);
  } catch {
    return NextResponse.json({ error: "Google not connected" }, { status: 403 });
  }

  // Get the user's current grocery list
  const groceryList = await prisma.groceryList.findFirst({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { where: { isChecked: false }, orderBy: { sortOrder: "asc" } } },
  });

  if (!groceryList || groceryList.items.length === 0) {
    return NextResponse.json({ error: "No unchecked items to sync" }, { status: 400 });
  }

  let listId: string;
  try {
    listId = await getOrCreateTaskList(userId, token);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to access Google Tasks" },
      { status: 502 }
    );
  }

  // Clear existing tasks in the list
  await fetch(`${TASKS_API}/lists/${listId}/clear`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  // Insert each unchecked item as a Google Task
  const results = await Promise.allSettled(
    groceryList.items.map((item) => {
      const qty   = item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "";
      const title = qty ? `${item.name} (${qty})` : item.name;
      return fetch(`${TASKS_API}/lists/${listId}/tasks`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ title }),
      });
    })
  );

  const added   = results.filter((r) => r.status === "fulfilled").length;
  const failed  = results.length - added;

  return NextResponse.json({ ok: true, added, failed, listName: LIST_NAME });
}
