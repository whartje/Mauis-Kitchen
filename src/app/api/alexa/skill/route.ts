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
    intent?: {
      name: string;
      slots?: Record<string, { value?: string }>;
    };
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

/** Split "milk, eggs and butter" → ["milk", "eggs", "butter"] */
function parseItems(raw: string): string[] {
  return raw
    .split(/\s+and\s+|,\s*|\s*&\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Resolve account ──────────────────────────────────────────────────────────

async function resolveUserId(body: AlexaRequest): Promise<string | null> {
  const accessToken = body.session?.user?.accessToken;
  if (!accessToken) return null;
  const link = await prisma.alexaSkillLink.findUnique({ where: { accessToken } });
  return link?.userId ?? null;
}

// ─── Remove items handler ─────────────────────────────────────────────────────

async function runRemove(body: AlexaRequest, rawItems: string): Promise<NextResponse> {
  const userId = await resolveUserId(body);
  if (!userId) {
    return buildResponse(
      "Your Maui's Kitchen account isn't linked. Open the Alexa app, find the Maui's Kitchen skill, and tap Link Account."
    );
  }

  const items = parseItems(rawItems);
  if (items.length === 0) {
    return buildResponse("I didn't catch any items. Try saying: I bought milk and eggs.", false);
  }

  const pantryItems = await prisma.pantryItem.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  if (pantryItems.length === 0) {
    return buildResponse("Your Maui's Kitchen pantry is empty.");
  }

  const toRemove: string[] = [];
  const removedNames: string[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    let matched = false;
    for (const pantryItem of pantryItems) {
      if (toRemove.includes(pantryItem.id)) continue;
      if (fuzzyScore(item, pantryItem.name) >= 0.7) {
        toRemove.push(pantryItem.id);
        removedNames.push(pantryItem.name);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(item);
  }

  if (toRemove.length === 0) {
    return buildResponse(
      `I couldn't find ${items.join(" or ")} in your ${pantryItems.length}-item pantry. ` +
      `Make sure the names match what's in your pantry. What else did you buy, or say stop to finish.`,
      false
    );
  }

  await prisma.pantryItem.deleteMany({ where: { id: { in: toRemove }, userId } });

  const preview = removedNames.slice(0, 3).join(", ");
  const extra = removedNames.length > 3 ? ` and ${removedNames.length - 3} more` : "";
  const unmatchedNote = unmatched.length > 0
    ? ` Couldn't find ${unmatched.join(" or ")} in your pantry.`
    : "";

  return buildResponse(
    `Removed ${removedNames.length} item${removedNames.length !== 1 ? "s" : ""}: ${preview}${extra}.${unmatchedNote} What else did you buy, or say stop to finish.`,
    false  // keep session open for follow-up
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

  const skillId = body.context?.System?.application?.applicationId;
  if (process.env.ALEXA_SKILL_ID && skillId && skillId !== process.env.ALEXA_SKILL_ID) {
    return NextResponse.json({ error: "Skill ID mismatch" }, { status: 403 });
  }

  const reqType = body.request.type;

  // ── LaunchRequest ─────────────────────────────────────────────────────────
  if (reqType === "LaunchRequest") {
    const linked = !!body.session?.user?.accessToken;
    if (!linked) {
      return buildResponse(
        "Welcome to Maui's Kitchen. To get started, open the Alexa app, find the Maui's Kitchen skill, and tap Link Account.",
        false
      );
    }
    const userId = await resolveUserId(body);
    if (userId) {
      const count = await prisma.pantryItem.count({ where: { userId } });
      return buildResponse(
        `Welcome to Maui's Kitchen. You have ${count} item${count !== 1 ? "s" : ""} in your pantry. What did you buy?`,
        false
      );
    }
    return buildResponse(
      "Welcome to Maui's Kitchen. What did you buy? Say something like: I bought milk and eggs.",
      false
    );
  }

  // ── SessionEndedRequest ───────────────────────────────────────────────────
  if (reqType === "SessionEndedRequest") {
    return NextResponse.json({ version: "1.0", response: {} });
  }

  // ── IntentRequest ─────────────────────────────────────────────────────────
  if (reqType === "IntentRequest") {
    const intentName = body.request.intent?.name ?? "";

    if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
      return buildResponse("Goodbye!");
    }

    if (intentName === "AMAZON.HelpIntent") {
      return buildResponse(
        "Tell me what you bought and I'll remove those items from your Maui's Kitchen pantry. " +
        "You can say things like: I bought milk and eggs, or I picked up butter and cheese. " +
        "You can also go straight to it by saying: Alexa, tell Maui's Kitchen I bought milk. " +
        "What did you buy?",
        false
      );
    }

    if (intentName === "RemoveItemsIntent") {
      const rawItems = body.request.intent?.slots?.items?.value ?? "";
      if (!rawItems) {
        return buildResponse(
          "I didn't catch what you bought. Try saying: I bought milk and eggs.",
          false
        );
      }
      return runRemove(body, rawItems);
    }
  }

  return buildResponse(
    "Try saying what you bought — for example: I bought milk and eggs."
  );
}
