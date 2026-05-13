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
    return buildResponse("I didn't catch any items. Try saying: I bought milk and eggs.");
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

  for (const item of items) {
    for (const pantryItem of pantryItems) {
      if (toRemove.includes(pantryItem.id)) continue;
      if (fuzzyScore(item, pantryItem.name) >= 0.7) {
        toRemove.push(pantryItem.id);
        removedNames.push(pantryItem.name);
      }
    }
  }

  if (toRemove.length === 0) {
    return buildResponse(
      `I checked "${items.join(", ")}" against your ${pantryItems.length}-item pantry but found no matches. Make sure the items are spelled the same way as in your pantry.`
    );
  }

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
        "Say what you bought and I'll remove it from your pantry. For example: I bought milk and eggs.",
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
