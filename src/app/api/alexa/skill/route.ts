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
    };
  };
  request: {
    type: string;
    intent?: { name: string };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildResponse(speechText: string, endSession = true) {
  return NextResponse.json({
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: speechText },
      shouldEndSession: endSession,
    },
  });
}

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

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: AlexaRequest;
  try {
    body = (await req.json()) as AlexaRequest;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Optionally verify the skill ID to prevent spoofing
  const skillId = body.context?.System?.application?.applicationId;
  if (process.env.ALEXA_SKILL_ID && skillId && skillId !== process.env.ALEXA_SKILL_ID) {
    return NextResponse.json({ error: "Skill ID mismatch" }, { status: 403 });
  }

  const reqType = body.request.type;

  // ── LaunchRequest ──────────────────────────────────────────────────────────
  if (reqType === "LaunchRequest") {
    return buildResponse(
      "Welcome to Maui's Kitchen. Say sync my pantry to compare your Alexa grocery list with your pantry.",
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
        "Say sync my pantry to remove items from your Maui's Kitchen pantry that are currently on your Alexa grocery list.",
        false
      );
    }

    if (intentName === "SyncPantryIntent") {
      // Validate account linking
      const accessToken = body.session?.user?.accessToken;
      if (!accessToken) {
        return buildResponse(
          "Please link your Maui's Kitchen account first. Open the Alexa app, go to the Maui's Kitchen skill, and tap Link Account."
        );
      }

      const skillLink = await prisma.alexaSkillLink.findUnique({ where: { accessToken } });
      if (!skillLink) {
        return buildResponse(
          "I couldn't find your account. Please re-link Maui's Kitchen in the Alexa app."
        );
      }

      const { userId, listName } = skillLink;
      const { apiEndpoint, apiAccessToken } = body.context.System;

      // ── Fetch Alexa lists ────────────────────────────────────────────────
      const listsRes = await fetch(`${apiEndpoint}/v2/householdlists/`, {
        headers: { Authorization: `Bearer ${apiAccessToken}` },
      });

      if (!listsRes.ok) {
        return buildResponse(
          "I couldn't access your Alexa lists. Make sure the Maui's Kitchen skill has List permissions enabled."
        );
      }

      const listsData = (await listsRes.json()) as {
        lists?: Array<{ listId: string; name: string; state: string }>;
      };
      const activeLists = (listsData.lists ?? []).filter((l) => l.state === "active");

      // Find the right list: match by stored name, then fuzzy, then first active
      const targetList =
        activeLists.find((l) => l.name.toLowerCase() === listName.toLowerCase()) ??
        activeLists.find((l) => /grocery|shopping/i.test(l.name)) ??
        activeLists[0] ??
        null;

      if (!targetList) {
        return buildResponse("I couldn't find any active shopping lists on your Alexa account.");
      }

      // ── Fetch list items ─────────────────────────────────────────────────
      const itemsRes = await fetch(
        `${apiEndpoint}/v2/householdlists/${targetList.listId}/active/items`,
        { headers: { Authorization: `Bearer ${apiAccessToken}` } }
      );

      if (!itemsRes.ok) {
        return buildResponse(`I had trouble reading your ${targetList.name} list. Please try again.`);
      }

      const itemsData = (await itemsRes.json()) as {
        items?: Array<{ id: string; value: string }>;
      };
      const alexaItems = itemsData.items ?? [];

      if (alexaItems.length === 0) {
        return buildResponse(`Your ${targetList.name} list is empty, so there's nothing to sync.`);
      }

      // ── Fetch pantry ─────────────────────────────────────────────────────
      const pantryItems = await prisma.pantryItem.findMany({
        where: { userId },
        select: { id: true, name: true },
      });

      if (pantryItems.length === 0) {
        return buildResponse("Your Maui's Kitchen pantry is empty.");
      }

      // ── Fuzzy match ──────────────────────────────────────────────────────
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
          `I compared your ${targetList.name} list with your ${pantryItems.length}-item pantry but found no matches.`
        );
      }

      // ── Remove matched pantry items ──────────────────────────────────────
      await prisma.pantryItem.deleteMany({
        where: { id: { in: toRemove }, userId },
      });

      const preview = removedNames.slice(0, 3).join(", ");
      const extra = removedNames.length > 3 ? ` and ${removedNames.length - 3} more` : "";

      return buildResponse(
        `Done! Removed ${removedNames.length} item${removedNames.length !== 1 ? "s" : ""} from your pantry: ${preview}${extra}.`
      );
    }
  }

  // Fallback
  return buildResponse("I didn't understand that. Try saying sync my pantry.");
}
