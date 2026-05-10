import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface CuratedRecipe {
  title: string;
  link: string;
  pubDate: string | null;
  image: string | null;
  description: string | null;
  siteName: string;
  siteKey: string;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
};

// ─── Site config ──────────────────────────────────────────────────────────────

interface SiteConfig {
  label: string;
  baseUrl: string;          // WordPress site root
  feedUrl: string;          // RSS fallback
  searchUrl: string;        // RSS search fallback
}

const SITES: Record<string, SiteConfig> = {
  minimalistbaker: {
    label: "Minimalist Baker",
    baseUrl: "https://minimalistbaker.com",
    feedUrl: "https://minimalistbaker.com/feed/",
    searchUrl: "https://minimalistbaker.com/?s={q}&feed=rss2",
  },
  ohsheglows: {
    label: "Oh She Glows",
    baseUrl: "https://ohsheglows.com",
    feedUrl: "https://ohsheglows.com/feed/",
    searchUrl: "https://ohsheglows.com/?s={q}&feed=rss2",
  },
  lazycatkitchen: {
    label: "Lazy Cat Kitchen",
    baseUrl: "https://lazycatkitchen.com",
    feedUrl: "https://lazycatkitchen.com/feed/",
    searchUrl: "https://lazycatkitchen.com/?s={q}&feed=rss2",
  },
  loveandlemons: {
    label: "Love and Lemons",
    baseUrl: "https://loveandlemons.com",
    feedUrl: "https://loveandlemons.com/feed/",
    searchUrl: "https://loveandlemons.com/?s={q}&feed=rss2",
  },
  rainbowplantlife: {
    label: "Rainbow Plant Life",
    baseUrl: "https://rainbowplantlife.com",
    feedUrl: "https://rainbowplantlife.com/feed/",
    searchUrl: "https://rainbowplantlife.com/?s={q}&feed=rss2",
  },
  simpleveganista: {
    label: "Simple Veganista",
    baseUrl: "https://simple-veganista.com",
    feedUrl: "https://simple-veganista.com/feed/",
    searchUrl: "https://simple-veganista.com/?s={q}&feed=rss2",
  },
  sharonpalmer: {
    label: "Sharon Palmer",
    baseUrl: "https://sharonpalmer.com",
    feedUrl: "https://sharonpalmer.com/feed/",
    searchUrl: "https://sharonpalmer.com/?s={q}&feed=rss2",
  },
  cookingforkeeps: {
    label: "Cooking For Keeps",
    baseUrl: "https://www.cookingforkeeps.com",
    feedUrl: "https://www.cookingforkeeps.com/feed/",
    searchUrl: "https://www.cookingforkeeps.com/?s={q}&feed=rss2",
  },
  recipetineats: {
    label: "RecipeTin Eats",
    baseUrl: "https://www.recipetineats.com",
    feedUrl: "https://www.recipetineats.com/feed/",
    searchUrl: "https://www.recipetineats.com/?s={q}&feed=rss2",
  },
  seasonsandsuppers: {
    label: "Seasons & Suppers",
    baseUrl: "https://www.seasonsandsuppers.ca",
    feedUrl: "https://www.seasonsandsuppers.ca/feed/",
    searchUrl: "https://www.seasonsandsuppers.ca/?s={q}&feed=rss2",
  },
  whippeditup: {
    label: "Whipped It Up",
    baseUrl: "https://www.whippeditup.com",
    feedUrl: "https://www.whippeditup.com/feed/",
    searchUrl: "https://www.whippeditup.com/?s={q}&feed=rss2",
  },
  foodie: {
    label: "Foodie",
    baseUrl: "https://www.foodie.com",
    feedUrl: "https://www.foodie.com/feed/",
    searchUrl: "https://www.foodie.com/?s={q}&feed=rss2",
  },
  smittenkitchen: {
    label: "Smitten Kitchen",
    baseUrl: "https://smittenkitchen.com",
    feedUrl: "https://smittenkitchen.com/feed/",
    searchUrl: "https://smittenkitchen.com/?s={q}&feed=rss2",
  },
  pinchofyum: {
    label: "Pinch of Yum",
    baseUrl: "https://pinchofyum.com",
    feedUrl: "https://pinchofyum.com/feed/",
    searchUrl: "https://pinchofyum.com/?s={q}&feed=rss2",
  },
  cookieandkate: {
    label: "Cookie and Kate",
    baseUrl: "https://cookieandkate.com",
    feedUrl: "https://cookieandkate.com/feed/",
    searchUrl: "https://cookieandkate.com/?s={q}&feed=rss2",
  },
};

// Happy Pear has no WP REST API or RSS — scrape their listing page directly
const HTML_SITES: Record<string, { label: string; listingUrl: string; domain: string }> = {
  happypear: {
    label: "Happy Pear",
    listingUrl: "https://thehappypear.ie/plant-based-vegan-recipes/",
    domain: "thehappypear.ie",
  },
};

// Spoonacular — structured recipe API (key already in env)
const SPOONACULAR_BASE = "https://api.spoonacular.com";

interface SpoonacularRecipe {
  id: number;
  title: string;
  image?: string;
  sourceUrl?: string;
  summary?: string;
}

// ─── Non-recipe title filter (title-only, no category check) ─────────────────

const NON_RECIPE_PATTERNS = [
  /\bat home:/i,
  /shopping list/i,
  /\d+\s+best\s+/i,
  /\bbest\s+\w+\s+sources?\b/i,
  /guide to/i,
  /tips\s+(for|on|to)\b/i,
  /^how\s+to\s+(?!make|cook|prepare)/i,
  /\bnewsletter\b/i,
  /weekly\s+meal\s+plan/i,
  /\binterview\b/i,
  /\bpodcast\b/i,
  /\bbook\s+review\b/i,
  /\bgiveaway\b/i,
  /\bfavorite\s+products\b/i,
  /\bround\s*up\b/i,
];

function isRecipeTitle(title: string): boolean {
  return !NON_RECIPE_PATTERNS.some((p) => p.test(title));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── WordPress REST API ───────────────────────────────────────────────────────

interface WpPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  excerpt: { rendered: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: { sizes?: { medium?: { source_url: string }; thumbnail?: { source_url: string } } };
    }>;
  };
}

function getWpImage(post: WpPost): string | null {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return null;
  return (
    media.media_details?.sizes?.medium?.source_url ??
    media.media_details?.sizes?.thumbnail?.source_url ??
    media.source_url ??
    null
  );
}

async function fetchViaWpApi(siteKey: string, query: string): Promise<CuratedRecipe[] | null> {
  const site = SITES[siteKey];
  const params = new URLSearchParams({
    per_page: "50",
    _embed: "wp:featuredmedia",
    orderby: "date",
    order: "desc",
    ...(query.trim() && { search: query.trim() }),
  });

  try {
    const res = await fetch(`${site.baseUrl}/wp-json/wp/v2/posts?${params}`, {
      headers: HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const posts: WpPost[] = await res.json();
    if (!Array.isArray(posts)) return null;

    return posts
      .map((p) => ({
        title: stripHtml(p.title.rendered),
        link: p.link,
        pubDate: p.date,
        image: getWpImage(p),
        description: stripHtml(p.excerpt.rendered).slice(0, 200) || null,
        siteName: site.label,
        siteKey,
      }))
      .filter((r) => isRecipeTitle(r.title));
  } catch {
    return null;
  }
}

// ─── RSS fallback ─────────────────────────────────────────────────────────────

function extractText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? stripHtml(m[1]) : null;
}

function extractLink(xml: string): string | null {
  let m = /<link>([^<]+)<\/link>/i.exec(xml);
  if (m) return m[1].trim();
  m = /<link[^>]+href="([^"]+)"/i.exec(xml);
  return m ? m[1].trim() : null;
}

function extractImage(xml: string): string | null {
  let m = /<media:content[^>]+url="([^"]+)"[^>]*medium="image"/i.exec(xml);
  if (m) return m[1];
  m = /<media:content[^>]+medium="image"[^>]*url="([^"]+)"/i.exec(xml);
  if (m) return m[1];
  m = /<media:thumbnail[^>]+url="([^"]+)"/i.exec(xml);
  if (m) return m[1];
  m = /<enclosure[^>]+type="image[^"]*"[^>]*url="([^"]+)"/i.exec(xml);
  if (m) return m[1];
  m = /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i.exec(xml);
  if (m) return m[1];
  m = /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/i.exec(xml);
  if (m) return m[1];
  return null;
}

async function fetchViaRss(siteKey: string, query: string): Promise<CuratedRecipe[]> {
  const site = SITES[siteKey];
  const url = query.trim()
    ? site.searchUrl.replace("{q}", encodeURIComponent(query.trim()))
    : site.feedUrl;

  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const results: CuratedRecipe[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRe.exec(xml)) !== null) {
      const chunk = match[1];
      const title = extractText(chunk, "title");
      const link = extractLink(chunk);
      if (!title || !link) continue;
      if (link.includes("/category/") || link.includes("/tag/") || link.includes("/page/")) continue;
      if (!isRecipeTitle(title)) continue;
      results.push({
        title,
        link,
        pubDate: extractText(chunk, "pubDate"),
        image: extractImage(chunk),
        description: extractText(chunk, "description")?.slice(0, 200) ?? null,
        siteName: site.label,
        siteKey,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Happy Pear HTML scraper ──────────────────────────────────────────────────

async function fetchHtmlSite(siteKey: string, query: string): Promise<CuratedRecipe[]> {
  const site = HTML_SITES[siteKey];
  if (!site) return [];
  try {
    const res = await fetch(site.listingUrl, { headers: HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const html = await res.text();
    const results: CuratedRecipe[] = [];
    const seen = new Set<string>();
    const anchorRe = /<a\s[^>]*href="(https?:\/\/[^"]*thehappypear\.ie\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = anchorRe.exec(html)) !== null) {
      const href = m[1];
      const inner = m[2];
      if (href.includes("/category/") || href.includes("/tag/") || href.includes("/page/") ||
          href.includes("/author/") || href.includes("#") || href === site.listingUrl || seen.has(href)) continue;
      const ariaLabel = /aria-label="([^"]+)"/i.exec(m[0])?.[1];
      const title = stripHtml(ariaLabel ?? inner);
      if (!title || title.length < 4 || !isRecipeTitle(title)) continue;
      const imgSrc = /<img[^>]+src="([^"]+)"/i.exec(inner)?.[1] ?? null;
      seen.add(href);
      results.push({ title, link: href, pubDate: null, image: imgSrc, description: null, siteName: site.label, siteKey });
    }
    const filtered = query.trim()
      ? results.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
      : results;
    return filtered.slice(0, 40);
  } catch {
    return [];
  }
}

// ─── BigOven — Next.js SPA, parse __NEXT_DATA__ ───────────────────────────────

async function fetchBigOven(query: string): Promise<CuratedRecipe[]> {
  try {
    const q = query.trim() || "dinner";
    const url = `https://www.bigoven.com/recipes/search?query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        ...HEADERS,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // BigOven is a Next.js app — the rendered JSON lives in __NEXT_DATA__
    const scriptMatch = /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!scriptMatch) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try { data = JSON.parse(scriptMatch[1]); } catch { return []; }

    /* BigOven has changed its pageProps layout a few times — try several paths */
    const pp = data?.props?.pageProps;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] =
      pp?.recipes?.Items ?? pp?.results?.Items ?? pp?.data?.Results ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.slice(0, 24).map((r: any) => {
      const id    = r.RecipeID ?? r.id ?? "";
      const title = String(r.Title ?? r.title ?? "");
      const slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return {
        title,
        link: `https://www.bigoven.com/recipe/${id}/${slug}`,
        pubDate: null,
        image: (r.ImageURL ?? r.PhotoUrl ?? null) as string | null,
        description: r.Description ? String(r.Description).slice(0, 200) : null,
        siteName: "BigOven",
        siteKey: "bigoven",
      };
    }).filter((r) => r.title.length > 2);
  } catch {
    return [];
  }
}

// ─── Spoonacular recipe discovery ─────────────────────────────────────────────

async function fetchSpoonacular(query: string): Promise<CuratedRecipe[]> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return [];

  try {
    let url: string;

    if (query.trim()) {
      // complexSearch returns structured results with images + source URLs
      const params = new URLSearchParams({
        query: query.trim(),
        number: "24",
        addRecipeInformation: "true",
        apiKey,
      });
      url = `${SPOONACULAR_BASE}/recipes/complexSearch?${params}`;
    } else {
      // Random popular recipes for the browse (no-query) case
      const params = new URLSearchParams({ number: "24", apiKey });
      url = `${SPOONACULAR_BASE}/recipes/random?${params}`;
    }

    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();

    // /random returns { recipes: [...] }, /complexSearch returns { results: [...] }
    const recipes: SpoonacularRecipe[] = data.recipes ?? data.results ?? [];

    return recipes
      .filter((r) => r.title && r.title.length > 2)
      .map((r) => ({
        title: r.title,
        link:
          r.sourceUrl ??
          `https://spoonacular.com/recipes/${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${r.id}`,
        pubDate: null,
        image: r.image ?? null,
        description: r.summary ? stripHtml(r.summary).slice(0, 200) : null,
        siteName: "Spoonacular",
        siteKey: "spoonacular",
      }));
  } catch {
    return [];
  }
}

// ─── Main fetch dispatcher ────────────────────────────────────────────────────

async function fetchSite(siteKey: string, query: string): Promise<CuratedRecipe[]> {
  if (siteKey === "spoonacular") return fetchSpoonacular(query);
  if (siteKey === "bigoven") return fetchBigOven(query);
  if (HTML_SITES[siteKey]) return fetchHtmlSite(siteKey, query);

  // Try WordPress REST API first (returns 50 posts with images)
  const wpResults = await fetchViaWpApi(siteKey, query);
  if (wpResults !== null && wpResults.length > 0) return wpResults;

  // Fall back to RSS if REST API unavailable or blocked
  return fetchViaRss(siteKey, query);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sitesParam = sp.get("sites") ?? "";
  const query = sp.get("q") ?? "";

  const allSiteKeys = [...Object.keys(SITES), ...Object.keys(HTML_SITES), "spoonacular", "bigoven"];
  const keys = sitesParam
    ? sitesParam.split(",").map((s) => s.trim()).filter((s) => allSiteKeys.includes(s))
    : allSiteKeys;

  const results = (await Promise.all(keys.map((k) => fetchSite(k, query)))).flat();

  // Sort by date descending; undated (Happy Pear) go last
  results.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return NextResponse.json({ results });
}
