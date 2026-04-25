import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  sourceName: string | null;
  spoonacularScore: number; // 0–100
  aggregateLikes: number;
  diets: string[];
  dishTypes: string[];
  summary: string;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SPOONACULAR_API_KEY not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const query = sp.get("q") ?? "";
  const diet = sp.get("diet") ?? "";
  const type = sp.get("type") ?? "";
  const cuisine = sp.get("cuisine") ?? "";
  const maxTime = sp.get("maxTime") ?? "";
  const sort = sp.get("sort") ?? "popularity";
  const offset = sp.get("offset") ?? "0";

  const params = new URLSearchParams({
    apiKey,
    number: "24",
    offset,
    addRecipeInformation: "true",
    minRating: "0.6",
    sort,
    sortDirection: "desc",
    ...(query && { query }),
    ...(diet && { diet }),
    ...(type && { type }),
    ...(cuisine && { cuisine }),
    ...(maxTime && { maxReadyTime: maxTime }),
  });

  const res = await fetch(
    `https://api.spoonacular.com/recipes/complexSearch?${params}`,
    { next: { revalidate: 300 } } // cache 5 min
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Spoonacular error:", res.status, text);
    return NextResponse.json(
      { error: "Recipe search failed. Check your API key or try again." },
      { status: 502 }
    );
  }

  const data = await res.json();
  const results: SpoonacularRecipe[] = (data.results ?? []).map((r: SpoonacularRecipe) => ({
    id: r.id,
    title: r.title,
    image: r.image,
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName ?? null,
    spoonacularScore: Math.round(r.spoonacularScore ?? 0),
    aggregateLikes: r.aggregateLikes ?? 0,
    diets: r.diets ?? [],
    dishTypes: r.dishTypes ?? [],
    summary: r.summary ?? "",
  }));

  return NextResponse.json({ results, totalResults: data.totalResults ?? 0 });
}
