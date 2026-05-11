export const maxDuration = 60;

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeRecipeFromText } from "@/lib/claude";
import { checkRecipeLimit, getSubSummary } from "@/lib/subscription";
import { createClient } from "@supabase/supabase-js";
import {
  YoutubeTranscript,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableLanguageError,
} from "youtube-transcript";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const Schema = z.object({
  url: z.string().url(),
  collection: z.string().min(1).optional().nullable(),
});

/** Extract a YouTube video ID from any common URL format. */
function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split(/[?&#]/)[0] || null;
    // youtube.com/shorts/<id>
    const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v) return v;
    // youtube.com/embed/<id>
    const embedMatch = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch {
    /* invalid URL */
  }
  return null;
}

/** Download a URL and upload it to Supabase storage. Returns the public URL. */
async function uploadThumbnailFromUrl(
  imageUrl: string,
  userId: string,
  recipeId: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const filename = `${userId}/${recipeId}-youtube-thumb.${ext}`;
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(filename, buffer, { contentType, upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("recipe-images").getPublicUrl(filename);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  // ── Pro gate ─────────────────────────────────────────────────────────────
  const sub = await getSubSummary(userId);
  if (!sub.isPro) {
    return NextResponse.json(
      {
        error: {
          code: "PRO_REQUIRED",
          message: "YouTube importing is a Pro feature. Upgrade to unlock it.",
        },
      },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "A valid YouTube URL is required." } },
      { status: 400 }
    );
  }

  const { url, collection } = parsed.data;

  // ── Validate YouTube URL ──────────────────────────────────────────────────
  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "That doesn't look like a valid YouTube URL." } },
      { status: 400 }
    );
  }

  // ── Recipe limit check ────────────────────────────────────────────────────
  const limit = await checkRecipeLimit(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RECIPE_LIMIT_REACHED",
          message: `You've reached the ${limit.limit}-recipe limit. Upgrade to Pro for unlimited recipes.`,
        },
      },
      { status: 403 }
    );
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const canonical = `https://www.youtube.com/watch?v=${videoId}`;
  const existing = await prisma.recipe.findFirst({
    where: { userId, sourceUrl: canonical },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "DUPLICATE", message: "You already have this video saved.", existingId: existing.id } },
      { status: 409 }
    );
  }

  // ── Fetch oEmbed metadata ─────────────────────────────────────────────────
  let videoTitle = "YouTube Recipe";
  let thumbnailUrl: string | null = null;
  let channelName: string | null = null;
  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`
    );
    if (oembedRes.ok) {
      const oembed = await oembedRes.json() as {
        title?: string;
        thumbnail_url?: string;
        author_name?: string;
      };
      if (oembed.title) videoTitle = oembed.title;
      if (oembed.thumbnail_url) thumbnailUrl = oembed.thumbnail_url;
      if (oembed.author_name) channelName = oembed.author_name;
    }
  } catch {
    /* oEmbed is optional — continue without it */
  }

  // ── Fetch transcript ──────────────────────────────────────────────────────
  // Pass a cache-bypassing fetch so Next.js's extended fetch doesn't
  // interfere with the InnerTube API POST or the caption XML download.
  const noStoreFetch: typeof fetch = (url, init) =>
    fetch(url, { ...init, cache: "no-store" });

  // Try without a language override first (picks whatever track is default),
  // then fall back to explicit language codes in case the auto-generated
  // track (kind=asr) isn't matched by the default selection.
  const langCandidates = [undefined, "en", "en-US", "en-GB"];
  let segments: { text: string }[] = [];
  let lastError: unknown;

  for (const lang of langCandidates) {
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId, {
        fetch: noStoreFetch,
        ...(lang ? { lang } : {}),
      });
      if (segments.length > 0) { lastError = undefined; break; }
    } catch (err) {
      lastError = err;
      // Rate-limit hits all language attempts the same way — stop early
      if (err instanceof YoutubeTranscriptTooManyRequestError) break;
      // Wrong-language errors are expected; keep trying other codes
      if (!(err instanceof YoutubeTranscriptNotAvailableLanguageError)) break;
    }
  }

  if (segments.length === 0) {
    console.error("Transcript fetch failed:", lastError);
    const isRateLimited = lastError instanceof YoutubeTranscriptTooManyRequestError;
    const isDisabled    = lastError instanceof YoutubeTranscriptDisabledError;
    return NextResponse.json(
      {
        error: {
          code: isRateLimited ? "RATE_LIMITED" : "NO_TRANSCRIPT",
          message: isRateLimited
            ? "YouTube is temporarily rate-limiting this server. Please try again in a few minutes."
            : isDisabled
            ? "Captions are disabled on this video. Try a video that has auto-generated subtitles enabled."
            : "Could not read captions for this video. Make sure the video has captions turned on, then try again.",
        },
      },
      { status: 422 }
    );
  }

  const transcriptText = segments.map((s) => s.text).join(" ");

  if (transcriptText.trim().length < 50) {
    return NextResponse.json(
      {
        error: {
          code: "TRANSCRIPT_TOO_SHORT",
          message: "The transcript for this video is too short to extract a recipe from.",
        },
      },
      { status: 422 }
    );
  }

  // ── Parse recipe from transcript ──────────────────────────────────────────
  const inputText = `Video title: ${videoTitle}\nChannel: ${channelName ?? "Unknown"}\n\nTranscript:\n${transcriptText}`;
  let recipe;
  try {
    recipe = await normalizeRecipeFromText(inputText);
  } catch (err) {
    console.error("YouTube recipe parse error:", err);
    return NextResponse.json(
      {
        error: {
          code: "AI_ERROR",
          message:
            "Could not extract a recipe from this video's transcript. Make sure the video is a cooking tutorial with step-by-step instructions.",
        },
      },
      { status: 422 }
    );
  }

  // ── Create placeholder recipe to get an ID for thumbnail storage ──────────
  const saved = await prisma.recipe.create({
    data: {
      userId,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      difficulty: recipe.difficulty,
      tags: recipe.tags,
      imageUrl: null,
      imageGallery: [],
      sourceUrl: canonical,
      sourceName: "YouTube",
      collection: collection ?? undefined,
      ingredients: {
        create: recipe.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          raw: ing.raw,
          notes: ing.notes ?? null,
          category: ing.category,
          sortOrder: idx,
        })),
      },
      instructions: {
        create: recipe.instructions.map((step) => ({
          stepNumber: step.stepNumber,
          text: step.text,
        })),
      },
    },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      instructions: { orderBy: { stepNumber: "asc" } },
      nutrition: true,
    },
  });

  // ── Upload YouTube thumbnail to Supabase (best-effort) ────────────────────
  if (thumbnailUrl) {
    // Prefer the maxresdefault quality; fall back to the oEmbed URL as-is
    const hiResThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const uploadedUrl =
      (await uploadThumbnailFromUrl(hiResThumbnail, userId, saved.id)) ??
      (await uploadThumbnailFromUrl(thumbnailUrl, userId, saved.id));

    if (uploadedUrl) {
      await prisma.recipe.update({
        where: { id: saved.id },
        data: { imageUrl: uploadedUrl, imageGallery: [uploadedUrl] },
      });
      return NextResponse.json({ ...saved, imageUrl: uploadedUrl, imageGallery: [uploadedUrl] }, { status: 201 });
    }
  }

  return NextResponse.json(saved, { status: 201 });
}
