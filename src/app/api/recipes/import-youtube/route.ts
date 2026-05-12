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

  // ── YouTube monthly import cap (20 / month for Pro) ──────────────────────
  const YT_MONTHLY_LIMIT = 20;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const ytThisMonth = await prisma.recipe.count({
    where: { userId, sourceName: "YouTube", createdAt: { gte: startOfMonth } },
  });
  if (ytThisMonth >= YT_MONTHLY_LIMIT) {
    return NextResponse.json(
      {
        error: {
          code: "YT_LIMIT_REACHED",
          message: `You've used all ${YT_MONTHLY_LIMIT} YouTube imports for this month. Your limit resets on the 1st.`,
        },
      },
      { status: 429 }
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
  // YouTube's InnerTube API serves different responses to datacenter IPs
  // (like Vercel) vs residential IPs. The youtube-transcript library uses
  // the Android client context which gets stripped caption data on servers.
  // We try three alternative client contexts first (TVHTML5 → WEB_EMBEDDED
  // → WEB), which are granted different access rules by YouTube's CDN, then
  // fall back to the library's own HTML-scraping path as a last resort.

  const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

  type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };

  async function fetchPlayerData(
    clientName: string,
    clientVersion: string,
    userAgent: string,
    clientNameId: string,
  ): Promise<{ tracks: CaptionTrack[] | null; description: string | null }> {
    try {
      const res = await fetch(INNERTUBE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          "X-YouTube-Client-Name": clientNameId,
          "X-YouTube-Client-Version": clientVersion,
          "Origin": "https://www.youtube.com",
          "Referer": `https://www.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify({
          context: { client: { clientName, clientVersion, hl: "en" } },
          videoId,
        }),
        cache: "no-store",
      });
      if (!res.ok) return { tracks: null, description: null };
      const data = await res.json() as {
        captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
        videoDetails?: { shortDescription?: string };
      };
      const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      const description = data?.videoDetails?.shortDescription ?? null;
      return {
        tracks: Array.isArray(tracks) && tracks.length > 0 ? tracks : null,
        description: description && description.length > 50 ? description : null,
      };
    } catch {
      return { tracks: null, description: null };
    }
  }

  async function fetchTranscriptFromTrack(track: CaptionTrack): Promise<string | null> {
    try {
      // Prefer JSON3 format; fall back to the raw XML format
      const res = await fetch(`${track.baseUrl}&fmt=json3`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as {
          events?: Array<{ segs?: Array<{ utf8: string }> }>;
        };
        const text = (data.events ?? [])
          .flatMap((e) => e.segs ?? [])
          .map((s) => s.utf8)
          .filter((t): t is string => !!t && t !== "\n")
          .join(" ")
          .trim();
        if (text.length > 0) return text;
      }
      // JSON3 failed — try raw XML
      const xmlRes = await fetch(track.baseUrl, { cache: "no-store" });
      if (!xmlRes.ok) return null;
      const xml = await xmlRes.text();
      const text = xml
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, " ").trim();
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  // Only IOS and ANDROID InnerTube clients return caption track data.
  // WEB/TV clients get empty captions objects even locally.
  // Try IOS first — it uses a distinct user-agent and YouTube applies
  // different server-side policies to iOS app traffic vs Android, which
  // can make the difference when requests come from Vercel datacenter IPs.
  const CLIENT_CONFIGS = [
    {
      clientName: "IOS",
      clientVersion: "20.10.4",
      userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
      clientNameId: "5",
    },
    {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
      clientNameId: "3",
    },
  ] as const;

  let transcriptText: string | null = null;
  let videoDescription: string | null = null;

  // 1. Try each custom InnerTube client context
  for (const cfg of CLIENT_CONFIGS) {
    const { tracks, description } = await fetchPlayerData(
      cfg.clientName, cfg.clientVersion, cfg.userAgent, cfg.clientNameId,
    );
    // Capture description from first successful player call as fallback
    if (description && !videoDescription) videoDescription = description;

    if (!tracks) continue;

    // Prefer English ASR/auto track; then any English; then first available
    const preferred =
      tracks.find((t) => t.languageCode.startsWith("en") && t.kind === "asr") ??
      tracks.find((t) => t.languageCode.startsWith("en")) ??
      tracks[0];

    transcriptText = await fetchTranscriptFromTrack(preferred);
    if (transcriptText) break;
  }

  // 2. Library fallback (handles HTML scraping path)
  if (!transcriptText) {
    const noStoreFetch: typeof fetch = (u, init) => fetch(u, { ...init, cache: "no-store" });
    for (const lang of [undefined, "en", "en-US"] as const) {
      try {
        const segs = await YoutubeTranscript.fetchTranscript(videoId, {
          fetch: noStoreFetch,
          ...(lang ? { lang } : {}),
        });
        if (segs.length > 0) {
          transcriptText = segs.map((s) => s.text).join(" ");
          break;
        }
      } catch (err) {
        if (err instanceof YoutubeTranscriptTooManyRequestError) break;
      }
    }
  }

  // 3. Description fallback — many channels post full recipes in their video description
  if (!transcriptText && videoDescription && videoDescription.trim().length >= 100) {
    transcriptText = `[No captions available — extracted from video description]\n\n${videoDescription}`;
  }

  if (!transcriptText || transcriptText.trim().length < 50) {
    return NextResponse.json(
      {
        error: {
          code: "NO_TRANSCRIPT",
          message: "Could not extract recipe content from this video. Try a video that has captions enabled or includes the full recipe in its description.",
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
