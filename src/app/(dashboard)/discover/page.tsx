import { auth } from "@clerk/nextjs/server";
import { DiscoverClient } from "@/components/discover/discover-client";
import type { SpoonacularRecipe } from "@/app/api/discover/route";

interface Props {
  searchParams: Promise<{
    q?: string;
    diet?: string;
    type?: string;
    maxTime?: string;
    sort?: string;
  }>;
}

async function fetchPopular(): Promise<SpoonacularRecipe[]> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      apiKey,
      number: "24",
      addRecipeInformation: "true",
      minRating: "0.6",
      diet: "vegan",
      sort: "popularity",
      sortDirection: "desc",
    });
    const res = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?${params}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

export default async function DiscoverPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const params = await searchParams;
  const hasQuery = !!(params.q || params.diet || params.type || params.maxTime);

  let initialResults: SpoonacularRecipe[] = [];

  if (hasQuery) {
    // Server-side fetch so first load has results
    const apiKey = process.env.SPOONACULAR_API_KEY;
    if (apiKey) {
      const sp = new URLSearchParams({
        apiKey,
        number: "24",
        addRecipeInformation: "true",
        minRating: "0.6",
        sort: params.sort ?? "popularity",
        sortDirection: "desc",
        ...(params.q && { query: params.q }),
        diet: params.diet ?? "vegan",
        ...(params.type && { type: params.type }),
        ...(params.maxTime && { maxReadyTime: params.maxTime }),
      });
      try {
        const res = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${sp}`, {
          next: { revalidate: 300 },
        });
        if (res.ok) {
          const data = await res.json();
          initialResults = data.results ?? [];
        }
      } catch {
        // client will retry
      }
    }
  } else {
    initialResults = await fetchPopular();
  }

  const apiConfigured = !!process.env.SPOONACULAR_API_KEY;

  if (!apiConfigured) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Discover Recipes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find popular recipes from across the web
          </p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 space-y-3">
          <p className="font-semibold text-amber-400">API Key Required</p>
          <p className="text-sm text-muted-foreground">
            This feature uses the Spoonacular API (free tier: 150 requests/day).
          </p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>
              Sign up at{" "}
              <span className="text-foreground font-mono">spoonacular.com/food-api</span>
            </li>
            <li>Copy your API key from the dashboard</li>
            <li>
              Add to your{" "}
              <span className="font-mono text-foreground">.env.local</span>:
              <pre className="mt-1 bg-secondary rounded p-2 text-xs text-foreground">
                SPOONACULAR_API_KEY=your_key_here
              </pre>
            </li>
            <li>Restart the dev server</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <DiscoverClient
      initialResults={initialResults}
      initialQuery={params.q ?? ""}
      initialFilters={{
        diet: params.diet ?? "vegan",
        type: params.type,
        maxTime: params.maxTime,
        sort: params.sort,
      }}
    />
  );
}
