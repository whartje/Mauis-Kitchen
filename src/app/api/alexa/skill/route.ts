import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlexaRequest {
  version: string;
  session?: {
    user?: { accessToken?: string };
  };
  context: {
    System: {
      apiEndpoint: string;
      apiAccessToken: string;
      application?: { applicationId?: string };
      // consentToken lives here when the user has granted list permissions
      user?: {
        permissions?: {
          consentToken?: string;
        };
      };
    };
  };
  request: {
    type: string;
    intent?: { name: string };
  };
}

// ─── Response builders ────────────────────────────────────────────────────────

function buildResponse(speechText: string, endSession = true) {
  return NextResponse.json({
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: speechText },
      shouldEndSession: endSession,
    },
  });
}

function buildPermissionsResponse() {
  return buildResponse(
    "Maui's Kitchen needs permission to access your Alexa lists. " +
    "Open the Alexa app, go to More, then Skills and Games, find Maui's Kitchen under Your Skills, " +
    "tap Settings, then Manage Permissions, and turn on Lists Read and Lists Write."
  );
}

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\d+\s*(oz|lb|g|kg|ml|l|cup|cups|tbsp|tsp|pack|packs|bunch|clove|cloves)s?\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function fuzzyScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const aWords = na.split(/\s+/);
  const bWords = nb.split(/\s+/);
  const common = aWords.filter((w) => bWords.includes(w) && w.length > 2);
  if (common.length > 0) return 0.7;
  return 0;
}

// ─── Core sync logic (shared by LaunchRequest + SyncPantryIntent) ─────────────

async function runSync(body: AlexaRequest): Promise<NextResponse> {
  const accessToken = body.session?.user?.accessToken;
  if (!accessToken) {
    return buildResponse(
      "Your Maui's Kitchen account isn't linked yet. Open the Alexa app, find the Maui's Kitchen skill, and tap Link Account."
    );
  }

  const skillLink = await prisma.alexaSkillLink.findUnique({ where: { accessToken } });
  if (!skillLink) {
    return buildResponse(
      "I couldn't find your account. Please re-link Maui's Kitchen in the Alexa app."
    );
  }

  const { userId, listName } = skillLink;

  // The consentToken (Atza|...) is the correct token for the Lists Management API.
  // apiAccessToken is Alexa's system token and only carries person_id:read scope —
  // it will always 404 on the Lists API regardless of which permissions are enabled.
  const consentToken = body.context.System.user?.permissions?.consentToken;
  const listsApiToken = consentToken ?? body.context.System.apiAccessToken;

  console.error("[alexa/skill] consentToken present:", !!consentToken);
  console.error("[alexa/skill] listsApiToken prefix:", listsApiToken.slice(0, 8));

  if (!consentToken) {
    // No consent token means the user hasn't granted list permissions yet
    console.error("[alexa/skill] No consentToken — user has not granted list permissions");
    return buildPermissionsResponse();
  }

  // ── Fetch the user's Alexa lists ───────────────────────────────────────────
  const ALEXA_API_BASE = "https://api.amazonalexa.com";
  const listsUrl = `${ALEXA_API_BASE}/v2/householdlists/`;
  console.error("[alexa/skill] GET", listsUrl);

  const listsRes = await fetch(listsUrl, {
    headers: {
      Authorization: `Bearer ${listsApiToken}`,
      Accept: "application/json",
    },
  });

  const listsBody = await listsRes.text();

  if (listsRes.status === 401 || listsRes.status === 403) {
    console.error("[alexa/skill] Lists auth error:", listsRes.status, listsBody.slice(0, 200));
    return buildPermissionsResponse();
  }

  if (!listsRes.ok) {
    console.error("[alexa/skill] Lists API error:", listsRes.status, listsBody.slice(0, 200));
    return buildResponse(
      `Lists API returned error ${listsRes.status}. Check Vercel logs for details.`
    );
  }

  let listsData: { lists?: Array<{ listId: string; name: string; state: string; statusMap?: Array<{ status: string; href: string }> }> };
  try {
    listsData = JSON.parse(listsBody);
  } catch {
    console.error("[alexa/skill] Failed to parse lists JSON:", listsBody.slice(0, 200));
    return buildResponse("Received an unexpected response from Amazon. Please try again.");
  }

  const activeLists = (listsData.lists ?? []).filter((l) => l.state === "active");
  console.info("[alexa/skill] active lists:", activeLists.map((l) => l.name));

  if (activeLists.length === 0) {
    return buildResponse("I couldn't find any active lists on your Alexa account.");
  }

  // Prefer the stored list name, then "Grocery"/"Shopping" by name, then first active
  const targetList =
    activeLists.find((l) => l.name.toLowerCase() === listName.toLowerCase()) ??
    activeLists.find((l) => /grocery|shopping/i.test(l.name)) ??
    activeLists[0];

  // Use Amazon's own href from statusMap — avoids any URL construction issues
  const activeHref =
    targetList.statusMap?.find((m) => m.status === "active")?.href ??
    `${ALEXA_API_BASE}/v2/householdlists/${encodeURIComponent(targetList.listId)}/active`;
  console.info("[alexa/skill] GET items", activeHref);

  // ── Fetch list items ───────────────────────────────────────────────────────
  const itemsRes = await fetch(activeHref, {
    headers: {
      Authorization: `Bearer ${listsApiToken}`,
      Accept: "application/json",
    },
  });

  if (itemsRes.status === 401 || itemsRes.status === 403) return buildPermissionsResponse();

  if (!itemsRes.ok) {
    const errBody = await itemsRes.text();
    console.error("[alexa/skill] Items API error:", itemsRes.status, errBody, "url:", activeHref);
    return buildResponse(
      `Step 2 failed — error ${itemsRes.status} fetching ${targetList.name} items. Check Vercel logs.`
    );
  }

  const itemsData = (await itemsRes.json()) as {
    items?: Array<{ id: string; value: string }>;
  };
  const alexaItems = itemsData.items ?? [];
  console.info("[alexa/skill] list items count:", alexaItems.length);

  if (alexaItems.length === 0) {
    return buildResponse(`Your ${targetList.name} list is empty — nothing to sync.`);
  }

  // ── Fetch pantry ───────────────────────────────────────────────────────────
  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  if (pantryItems.length === 0) {
    return buildResponse("Your Maui's Kitchen pantry is empty.");
  }

  // ── Fuzzy match ────────────────────────────────────────────────────────────
  const toRemove: string[] = [];
  const removedNames: string[] = [];

  for (const alexaItem of alexaItems) {
    for (const pantryItem of pantryItems) {
      if (toRemove.includes(pantryItem.id)) continue;
      const score = fuzzyScore(alexaItem.value, pantryItem.name);
      if (score >= 0.7) {
        toRemove.push(pantryItem.id);
        removedNames.push(pantryItem.name);
      }
    }
  }

  if (toRemove.length === 0) {
    return buildResponse(
      `I checked your ${targetList.name} list against your ${pantryItems.length}-item pantry but found no matching items.`
    );
  }

  // ── Remove matched pantry items ────────────────────────────────────────────
  await prisma.pantryItem.deleteMany({ where: { id: { in: toRemove }, userId } });

  const preview = removedNames.slice(0, 3).join(", ");
  const extra = removedNames.length > 3 ? ` and ${removedNames.length - 3} more` : "";

  return buildResponse(
    `Done! Removed ${removedNames.length} item${removedNames.length !== 1 ? "s" : ""} from your pantry: ${preview}${extra}.`
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: AlexaRequest;
  try {
    body = (await req.json()) as AlexaRequest;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Optional skill ID verification
  const skillId = body.context?.System?.application?.applicationId;
  if (process.env.ALEXA_SKILL_ID && skillId && skillId !== process.env.ALEXA_SKILL_ID) {
    return NextResponse.json({ error: "Skill ID mismatch" }, { status: 403 });
  }

  const reqType = body.request.type;

  // ── LaunchRequest — auto-sync so "Alexa, open Maui's Kitchen" works too ────
  if (reqType === "LaunchRequest") {
    if (body.session?.user?.accessToken) {
      return runSync(body);
    }
    return buildResponse(
      "Welcome to Maui's Kitchen. To get started, open the Alexa app, find the Maui's Kitchen skill, and tap Link Account.",
      false
    );
  }

  // ── SessionEndedRequest ────────────────────────────────────────────────────
  if (reqType === "SessionEndedRequest") {
    return NextResponse.json({ version: "1.0", response: {} });
  }

  // ── IntentRequest ──────────────────────────────────────────────────────────
  if (reqType === "IntentRequest") {
    const intentName = body.request.intent?.name ?? "";

    if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
      return buildResponse("Goodbye!");
    }

    if (intentName === "AMAZON.HelpIntent") {
      return buildResponse(
        "Just say open Maui's Kitchen and I'll sync your Alexa grocery list with your pantry automatically.",
        false
      );
    }

    if (intentName === "SyncPantryIntent") {
      return runSync(body);
    }
  }

  // Fallback
  return buildResponse("I didn't understand that. Try saying open Maui's Kitchen to sync your pantry.");
}
