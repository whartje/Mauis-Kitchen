export const maxDuration = 60;

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeRecipeFromText } from "@/lib/claude";
import { checkRecipeLimit, getSubSummary } from "@/lib/subscription";
import { createClient } from "@supabase/supabase-js";
import { ApifyClient } from "apify-client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const Schema = z.object({
  url: z.string().url(),
  collection: z.string().min(1).optional().nullable(),
});

type Platform = "instagram" | "tiktok";

function detectPlatform(url: string): Platform | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram.com")) return "instagram";
    if (u.hostname.includes("tiktok.com")) return "tiktok";
  } catch {
    /* invalid url */
  }
  return null;
}

async function uploadThumbnailFromUrl(
  imageUrl: string,
  userId: string,
  recipeId: string,
  sourceName: string
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const slug = sourceName.toLowerCase();
    const filename = `${userId}/${recipeId}-${slug}-thumb.${ext}`;
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
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "A valid URL is required." } },
      { status: 400 }
    );
  }

  const { url, collection } = parsed.data;

  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Please enter a valid Instagram or TikTok URL." } },
      { status: 400 }
    );
  }

  // ── Social monthly import cap (5 free / 50 pro) ───────────────────────────
  const sub = await getSubSummary(userId);
  const SOCIAL_LIMIT = sub.isPro ? 50 : 5;
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const socialThisMonth = await prisma.recipe.count({
    where: {
      userId,
      sourceName: { in: ["Instagram", "TikTok"] },
      importedAt: { gte: startOfMonth },
    },
  });
  if (socialThisMonth >= SOCIAL_LIMIT) {
    return NextResponse.json(
      {
        error: {
          code: "SOCIAL_LIMIT_REACHED",
          message: `You've used all ${SOCIAL_LIMIT} social imports for this month. ${
            sub.isPro ? "Your limit resets on the 1st." : "Upgrade to Pro for 50/month."
          }`,
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

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Social import is not available right now." } },
      { status: 503 }
    );
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  let captionText: string | null = null;
  let thumbnailUrl: string | null = null;
  let authorName: string | null = null;
  const sourceName = platform === "instagram" ? "Instagram" : "TikTok";

  // ── Scrape ────────────────────────────────────────────────────────────────
  if (platform === "instagram") {
    try {
      // apify/instagram-scraper is the main actor; instagram-post-scraper uses
      // a different (less documented) input schema and is less reliable.
      const run = await client.actor("apify/instagram-scraper").call(
        {
          directUrls: [url],
          resultsType: "posts",
          resultsLimit: 1,
          addParentData: false,
        },
        { waitSecs: 90 }
      );
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log("Instagram scrape result count:", items.length, items[0] ? Object.keys(items[0]) : "no items");

      const post = items[0] as {
        caption?: string;
        alt?: string;                  // some actors use alt for caption
        displayUrl?: string;
        imageUrl?: string;
        images?: string[];
        thumbnailUrl?: string;
        ownerUsername?: string;
        ownerFullName?: string;
      } | undefined;

      if (!post) {
        return NextResponse.json(
          {
            error: {
              code: "SCRAPE_FAILED",
              message:
                "Could not fetch this Instagram post. Make sure the post is public and not from a private account.",
            },
          },
          { status: 422 }
        );
      }

      captionText = post.caption ?? post.alt ?? null;
      thumbnailUrl =
        post.displayUrl ?? post.imageUrl ?? post.thumbnailUrl ?? (post.images?.[0] ?? null);
      authorName = post.ownerUsername
        ? `@${post.ownerUsername}`
        : (post.ownerFullName ?? null);
    } catch (err) {
      console.error("Instagram scrape error:", err);
      return NextResponse.json(
        { error: { code: "SCRAPE_FAILED", message: "Could not fetch this Instagram post. Make sure it's public and try again." } },
        { status: 422 }
      );
    }
  } else {
    // TikTok
    try {
      const run = await client.actor("clockworks/tiktok-scraper").call(
        {
          postURLs: [url],
          resultsPerPage: 1,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
          shouldDownloadSlideshowImages: false,
        },
        { waitSecs: 60 }
      );
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      const post = items[0] as {
        text?: string;
        description?: string;
        videoMeta?: { coverUrl?: string };
        covers?: string[];
        authorMeta?: { name?: string; nickName?: string };
      } | undefined;

      if (!post) {
        return NextResponse.json(
          { error: { code: "SCRAPE_FAILED", message: "Could not fetch this TikTok video. Make sure it's a public video." } },
          { status: 422 }
        );
      }

      captionText = post.text ?? post.description ?? null;
      thumbnailUrl = post.videoMeta?.coverUrl ?? (post.covers?.[0] ?? null);
      authorName = post.authorMeta?.nickName ?? post.authorMeta?.name ?? null;
    } catch (err) {
      console.error("TikTok scrape error:", err);
      return NextResponse.json(
        { error: { code: "SCRAPE_FAILED", message: "Could not fetch this TikTok video. Make sure it's public and try again." } },
        { status: 422 }
      );
    }
  }

  if (!captionText || captionText.trim().length < 30) {
    return NextResponse.json(
      {
        error: {
          code: "NO_RECIPE_CONTENT",
          message:
            platform === "tiktok"
              ? "This TikTok's caption doesn't contain enough recipe text. Try a post where the creator shared the full recipe in their caption (look for #recipeincaption posts)."
              : "This Instagram post doesn't appear to contain a recipe in its caption.",
        },
      },
      { status: 422 }
    );
  }

  // ── Duplicate check ───────────────────────────────────────────────────────
  const existing = await prisma.recipe.findFirst({
    where: { userId, sourceUrl: url },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: { code: "DUPLICATE", message: "You already have this post saved.", existingId: existing.id } },
      { status: 409 }
    );
  }

  // ── Parse recipe via Claude ───────────────────────────────────────────────
  const inputText = `${sourceName} post${authorName ? ` by ${authorName}` : ""}:\n\n${captionText}`;
  let recipe;
  try {
    recipe = await normalizeRecipeFromText(inputText);
  } catch (err) {
    console.error("Social recipe parse error:", err);
    return NextResponse.json(
      {
        error: {
          code: "AI_ERROR",
          message:
            "Could not extract a recipe from this post. Make sure the caption includes ingredients and instructions.",
        },
      },
      { status: 422 }
    );
  }

  // ── Save recipe ───────────────────────────────────────────────────────────
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
      sourceUrl: url,
      sourceName,
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

  // ── Upload thumbnail (best-effort) ────────────────────────────────────────
  if (thumbnailUrl) {
    const uploadedUrl = await uploadThumbnailFromUrl(thumbnailUrl, userId, saved.id, sourceName);
    if (uploadedUrl) {
      await prisma.recipe.update({
        where: { id: saved.id },
        data: { imageUrl: uploadedUrl, imageGallery: [uploadedUrl] },
      });
      return NextResponse.json(
        { ...saved, imageUrl: uploadedUrl, imageGallery: [uploadedUrl] },
        { status: 201 }
      );
    }
  }

  return NextResponse.json(saved, { status: 201 });
}
