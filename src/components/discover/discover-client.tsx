"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search, Star, Clock, ThumbsUp, Plus, Check,
  Loader2, ChevronDown, Globe, Calendar, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpoonacularRecipe } from "@/app/api/discover/route";
import type { CuratedRecipe } from "@/app/api/discover/curated/route";

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchResult =
  | { source: "spoonacular"; data: SpoonacularRecipe }
  | { source: "curated"; data: CuratedRecipe };

interface Props {
  initialResults: SpoonacularRecipe[];
  initialQuery: string;
  initialFilters: {
    diet?: string;
    type?: string;
    cuisine?: string;
    maxTime?: string;
    sort?: string;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FAVORITE_SITES = [
  { key: "minimalistbaker",  label: "Minimalist Baker" },
  { key: "ohsheglows",       label: "Oh She Glows" },
  { key: "lazycatkitchen",   label: "Lazy Cat Kitchen" },
  { key: "loveandlemons",    label: "Love and Lemons" },
  { key: "rainbowplantlife", label: "Rainbow Plant Life" },
  { key: "simpleveganista",  label: "Simple Veganista" },
  { key: "sharonpalmer",     label: "Sharon Palmer" },
  { key: "happypear",        label: "Happy Pear" },
  { key: "spoonacular",      label: "Spoonacular" },
];

const MEAL_TYPES = [
  { value: "breakfast", label: "🌅 Breakfast" },
  { value: "lunch",     label: "☀️ Lunch" },
  { value: "dinner",    label: "🌙 Dinner" },
  { value: "snack",     label: "🍎 Snack" },
  { value: "dessert",   label: "🍰 Dessert" },
  { value: "soup",      label: "🍲 Soup" },
  { value: "salad",     label: "🥗 Salad" },
];

const CUISINES = [
  { value: "italian",        label: "🇮🇹 Italian" },
  { value: "mexican",        label: "🇲🇽 Mexican" },
  { value: "indian",         label: "🇮🇳 Indian" },
  { value: "chinese",        label: "🇨🇳 Chinese" },
  { value: "japanese",       label: "🇯🇵 Japanese" },
  { value: "thai",           label: "🇹🇭 Thai" },
  { value: "mediterranean",  label: "🫒 Mediterranean" },
  { value: "middle eastern", label: "🧆 Middle Eastern" },
  { value: "american",       label: "🇺🇸 American" },
  { value: "french",         label: "🇫🇷 French" },
  { value: "greek",          label: "🇬🇷 Greek" },
  { value: "korean",         label: "🇰🇷 Korean" },
  { value: "vietnamese",     label: "🇻🇳 Vietnamese" },
  { value: "spanish",        label: "🇪🇸 Spanish" },
];

const DIETS = [
  { value: "vegan",       label: "🌱 Vegan" },
  { value: "vegetarian",  label: "🥦 Vegetarian" },
  { value: "gluten free", label: "🌾 Gluten-Free" },
  { value: "dairy free",  label: "🥛 Dairy-Free" },
  { value: "paleo",       label: "🥩 Paleo" },
  { value: "ketogenic",   label: "🧈 Keto" },
];

const TIME_OPTIONS = [
  { value: "",   label: "Any Time" },
  { value: "20", label: "Under 20 min" },
  { value: "30", label: "Under 30 min" },
  { value: "45", label: "Under 45 min" },
  { value: "60", label: "Under 1 hr" },
];

const SORT_OPTIONS = [
  { value: "popularity",  label: "Most Popular" },
  { value: "rating",      label: "Top Rated" },
  { value: "time",        label: "Quickest" },
  { value: "healthiness", label: "Healthiest" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  const stars = score / 20;
  const full = Math.floor(stars);
  const partial = stars - full;
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="relative w-3.5 h-3.5">
          <Star className="w-3.5 h-3.5 text-muted-foreground/30 fill-muted-foreground/10 absolute inset-0" />
          {i < full && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 absolute inset-0" />}
          {i === full && partial > 0 && (
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${partial * 100}%` }}>
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
          )}
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-1">{stars.toFixed(1)}</span>
    </div>
  );
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-brand-orange/15 border-brand-orange/40 text-brand-orange"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          <div className="h-44 bg-secondary" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-secondary rounded w-3/4" />
            <div className="h-3 bg-secondary rounded w-1/2" />
            <div className="h-3 bg-secondary rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscoverClient({ initialResults, initialQuery, initialFilters }: Props) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialFilters.type ?? "");
  const [cuisine, setCuisine] = useState(initialFilters.cuisine ?? "");
  const [diet, setDiet] = useState(initialFilters.diet ?? "");
  const [maxTime, setMaxTime] = useState(initialFilters.maxTime ?? "");
  const [sort, setSort] = useState(initialFilters.sort ?? "popularity");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SearchResult[]>(
    initialResults.map((r) => ({ source: "spoonacular", data: r }))
  );
  // hasSearched: true only if we arrived with a URL query or the user has interacted
  const [hasSearched, setHasSearched] = useState(initialResults.length > 0 && !!initialQuery.trim());
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // key → imported recipe ID (for navigation after import)
  const [imported, setImported] = useState<Map<string, string>>(new Map());
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(initialResults.length);
  const [totalResults, setTotalResults] = useState<number | null>(null);

  // Are we in "favorite sites" mode?
  const sitesMode = selectedSites.size > 0;

  // Source filter chips from Spoonacular results (when in explore mode)
  const availableSources = useMemo(() => {
    if (sitesMode) return [];
    const counts = new Map<string, number>();
    for (const r of results) {
      if (r.source === "spoonacular" && r.data.sourceName) {
        counts.set(r.data.sourceName, (counts.get(r.data.sourceName) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [results, sitesMode]);

  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const visibleResults = useMemo(() => {
    if (selectedSources.size === 0) return results;
    return results.filter(
      (r) => r.source === "spoonacular" && r.data.sourceName && selectedSources.has(r.data.sourceName)
    );
  }, [results, selectedSources]);

  // ── Search ───────────────────────────────────────────────────────────────

  async function doSearch(overrides?: {
    q?: string; type?: string; cuisine?: string; diet?: string;
    maxTime?: string; sort?: string; sites?: Set<string>;
  }) {
    const effectiveSites = overrides?.sites ?? selectedSites;
    setLoading(true);
    setError(null);
    setSelectedSources(new Set());
    setHasSearched(true);
    setOffset(0);
    setTotalResults(null);

    try {
      if (effectiveSites.size > 0) {
        // Favorite sites mode → RSS/HTML
        const params = new URLSearchParams();
        const q = overrides?.q ?? query;
        if (q.trim()) params.set("q", q.trim());
        params.set("sites", [...effectiveSites].join(","));
        const res = await fetch(`/api/discover/curated?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        const newResults = (data.results as CuratedRecipe[]).map((r) => ({ source: "curated" as const, data: r }));
        setResults(newResults);
        setOffset(newResults.length);
      } else {
        // Explore mode → Spoonacular
        const params = new URLSearchParams({
          q: overrides?.q ?? query,
          type: overrides?.type ?? type,
          cuisine: overrides?.cuisine ?? cuisine,
          diet: overrides?.diet ?? diet,
          maxTime: overrides?.maxTime ?? maxTime,
          sort: overrides?.sort ?? sort,
          offset: "0",
        });
        for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
        const res = await fetch(`/api/discover?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Search failed");
        const newResults = (data.results as SpoonacularRecipe[]).map((r) => ({ source: "spoonacular" as const, data: r }));
        setResults(newResults);
        setOffset(newResults.length);
        setTotalResults(data.totalResults ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function doLoadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        q: query,
        type,
        cuisine,
        diet,
        maxTime,
        sort,
        offset: String(offset),
      });
      for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
      const res = await fetch(`/api/discover?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load more failed");
      const newResults = (data.results as SpoonacularRecipe[]).map((r) => ({ source: "spoonacular" as const, data: r }));
      setResults((prev) => [...prev, ...newResults]);
      setOffset((prev) => prev + newResults.length);
      setTotalResults(data.totalResults ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleSite(key: string) {
    const next = new Set(selectedSites);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelectedSites(next);
    doSearch({ sites: next });
  }

  function toggleChip(key: "type" | "cuisine", value: string) {
    const current = key === "type" ? type : cuisine;
    const newVal = current === value ? "" : value;
    key === "type" ? setType(newVal) : setCuisine(newVal);
    doSearch({ [key]: newVal });
  }

  function handleFilterChange(key: "diet" | "maxTime" | "sort", value: string) {
    if (key === "diet") setDiet(value);
    if (key === "maxTime") setMaxTime(value);
    if (key === "sort") setSort(value);
    doSearch({ [key]: value });
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async function handleImport(result: SearchResult) {
    const key = result.source === "spoonacular"
      ? `sp-${result.data.id}`
      : `cu-${(result.data as CuratedRecipe).link}`;

    if (importing.has(key) || imported.has(key)) return;
    setImporting((s) => new Set([...s, key]));

    try {
      if (result.source === "spoonacular") {
        const res = await fetch("/api/discover/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spoonacularId: result.data.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setImported((s) => new Map([...s, [key, data.recipeId]]));
        }
      } else {
        const res = await fetch("/api/recipes/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: (result.data as CuratedRecipe).link }),
        });
        if (res.ok) {
          const data = await res.json();
          setImported((s) => new Map([...s, [key, data.id]]));
        }
      }
    } finally {
      setImporting((s) => { const ns = new Set(s); ns.delete(key); return ns; });
    }
  }

  const activeFilterCount = [type, cuisine, diet, maxTime].filter(Boolean).length + selectedSites.size;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Discover Recipes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search the web or browse your favorite sites
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <form onSubmit={(e) => { e.preventDefault(); doSearch(); }} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={sitesMode ? "Search within selected sites..." : "Search for any recipe..."}
            className="w-full bg-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
          />
          {/* Submit icon button inside the input */}
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-brand-orange transition-colors disabled:opacity-40"
            aria-label="Search"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />
            }
          </button>
        </form>

        {/* Compact filter toggle — icon + count badge only, mirrors Recipe Library */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg border text-sm font-medium transition-colors shrink-0",
            filtersOpen || activeFilterCount > 0
              ? "bg-brand-orange/10 border-brand-orange/40 text-brand-orange"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          {activeFilterCount > 0 && (
            <span className="bg-brand-orange text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 transition-transform", filtersOpen && "rotate-180")} />
        </button>
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">

          {/* Favorite Sites */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Favorite Sites
            </p>
            <div className="flex flex-wrap gap-2">
              {FAVORITE_SITES.map(({ key, label }) => (
                <Chip
                  key={key}
                  label={label}
                  active={selectedSites.has(key)}
                  onClick={() => toggleSite(key)}
                />
              ))}
            </div>
          </div>

          {/* Meal Type */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Meal Type
            </p>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((mt) => (
                <Chip
                  key={mt.value}
                  label={mt.label}
                  active={type === mt.value}
                  onClick={() => toggleChip("type", mt.value)}
                />
              ))}
            </div>
          </div>

          {/* Cuisine */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Cuisine
            </p>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  active={cuisine === c.value}
                  onClick={() => toggleChip("cuisine", c.value)}
                />
              ))}
            </div>
          </div>

          {/* Diet */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diet</p>
            <div className="flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <Chip
                  key={d.value}
                  label={d.label}
                  active={diet === d.value}
                  onClick={() => { const v = diet === d.value ? "" : d.value; setDiet(v); doSearch({ diet: v }); }}
                />
              ))}
            </div>
          </div>

          {/* Time / Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            {[
              { label: "Max Time", key: "maxTime" as const, value: maxTime, options: TIME_OPTIONS },
              { label: "Sort By",  key: "sort"    as const, value: sort,    options: SORT_OPTIONS },
            ].map(({ label, key, value, options }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  {label}
                </label>
                <select
                  value={value}
                  onChange={(e) => handleFilterChange(key, e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                >
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => {
                  setType(""); setCuisine(""); setDiet(""); setMaxTime("");
                  setSort("popularity"); setSelectedSites(new Set()); setSelectedSources(new Set());
                  doSearch({ type: "", cuisine: "", diet: "", maxTime: "", sort: "popularity", sites: new Set() });
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active filter summary */}
      {!filtersOpen && activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {selectedSites.size > 0 && [...selectedSites].map((k) => {
            const site = FAVORITE_SITES.find((s) => s.key === k);
            return site ? (
              <span key={k} className="flex items-center gap-1 px-3 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full">
                {site.label}
                <button onClick={() => toggleSite(k)} className="ml-0.5 hover:opacity-70">×</button>
              </span>
            ) : null;
          })}
          {type && (
            <span className="flex items-center gap-1 px-3 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full capitalize">
              {type} <button onClick={() => { setType(""); doSearch({ type: "" }); }} className="ml-0.5 hover:opacity-70">×</button>
            </span>
          )}
          {cuisine && (
            <span className="flex items-center gap-1 px-3 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full capitalize">
              {cuisine} <button onClick={() => { setCuisine(""); doSearch({ cuisine: "" }); }} className="ml-0.5 hover:opacity-70">×</button>
            </span>
          )}
          {(diet || maxTime) && (
            <button onClick={() => setFiltersOpen(true)} className="text-xs text-muted-foreground hover:text-foreground">
              +{[diet, maxTime].filter(Boolean).length} more filter{[diet, maxTime].filter(Boolean).length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Spoonacular website sub-filter (explore mode only) */}
      {!sitesMode && !loading && availableSources.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Website</span>
            {selectedSources.size > 0 && (
              <button onClick={() => setSelectedSources(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSources.map(({ name, count }) => (
              <button
                key={name}
                onClick={() => setSelectedSources((prev) => {
                  const next = new Set(prev);
                  next.has(name) ? next.delete(name) : next.add(name);
                  return next;
                })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                  selectedSources.has(name)
                    ? "bg-brand-orange/15 border-brand-orange/40 text-brand-orange"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {name}
                <span className={cn(
                  "text-xs rounded-full px-1.5 py-0.5 font-semibold",
                  selectedSources.has(name) ? "bg-brand-orange/20 text-brand-orange" : "bg-secondary text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Results */}
      {!loading && visibleResults.length > 0 && (
        <>
          {sitesMode && (
            <p className="text-sm text-muted-foreground">
              {visibleResults.length} recipe{visibleResults.length !== 1 ? "s" : ""} from {[...selectedSites].map((k) => FAVORITE_SITES.find((s) => s.key === k)?.label).filter(Boolean).join(", ")}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleResults.map((result, i) => {
              const key = result.source === "spoonacular"
                ? `sp-${result.data.id}`
                : `cu-${(result.data as CuratedRecipe).link}`;
              const importedRecipeId = imported.get(key);
              return (
                <ResultCard
                  key={key ?? i}
                  result={result}
                  isImported={imported.has(key)}
                  isImporting={importing.has(key)}
                  onImport={() => handleImport(result)}
                  onView={() => router.push(importedRecipeId ? `/recipes/${importedRecipeId}` : "/recipes")}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Load More */}
      {!loading && !sitesMode && totalResults !== null && offset < totalResults && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {offset} of {totalResults.toLocaleString()} recipes
          </p>
          <button
            onClick={doLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 bg-secondary border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-card hover:border-brand-orange/40 transition-colors disabled:opacity-60"
          >
            {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingMore ? "Loading…" : "Load More Recipes"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && visibleResults.length === 0 && hasSearched && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Search className="w-12 h-12 text-muted-foreground/20" />
          <div>
            <p className="font-medium text-foreground">No recipes found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or adjust your filters
            </p>
          </div>
        </div>
      )}

      {/* Initial state (no search yet) */}
      {!loading && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Search className="w-12 h-12 text-muted-foreground/20" />
          <div>
            <p className="font-medium text-foreground">Search for recipes</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use the search bar above, or open Filters to browse by meal type, cuisine, or your favorite sites
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({
  result, isImported, isImporting, onImport, onView,
}: {
  result: SearchResult;
  isImported: boolean;
  isImporting: boolean;
  onImport: () => void;
  onView: () => void;
}) {
  if (result.source === "spoonacular") {
    const r = result.data;
    const sourceUrl = r.sourceUrl ?? null;
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-brand-orange/30 transition-colors">
        {/* Clickable image → opens original recipe */}
        <a href={sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer"
          className="relative h-44 bg-secondary shrink-0 block group">
          {r.image ? (
            <Image src={r.image} alt={r.title} fill className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
          ) : (
            <div className="flex items-center justify-center h-full text-4xl">🍽️</div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
          </div>
          {r.diets.length > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap">
              {r.diets.slice(0, 2).map((d) => (
                <span key={d} className="px-2 py-0.5 bg-black/60 text-white text-xs rounded-full capitalize backdrop-blur-sm">{d}</span>
              ))}
            </div>
          )}
        </a>
        <div className="p-4 flex flex-col gap-2 flex-1">
          {/* Clickable title */}
          <a href={sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer"
            className="font-semibold text-foreground text-sm leading-snug line-clamp-2 hover:text-brand-orange transition-colors">
            {r.title}
          </a>
          <div className="flex items-center justify-between">
            <StarRating score={r.spoonacularScore} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ThumbsUp className="w-3 h-3" />
              <span>{r.aggregateLikes.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {r.readyInMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{r.readyInMinutes} min</span>
              </div>
            )}
            {r.sourceName && <span className="truncate text-muted-foreground/70">{r.sourceName}</span>}
          </div>
          <div className="mt-auto pt-2">
            <ImportButton isImported={isImported} isImporting={isImporting} onImport={onImport} onView={onView} />
          </div>
        </div>
      </div>
    );
  }

  const r = result.data as CuratedRecipe;
  const dateStr = r.pubDate
    ? new Date(r.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:border-brand-orange/30 transition-colors">
      {/* Clickable image → opens original recipe */}
      <a href={r.link} target="_blank" rel="noopener noreferrer"
        className="relative h-44 bg-secondary shrink-0 block group">
        {r.image ? (
          <Image src={r.image} alt={r.title} fill className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl">🍽️</div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
        </div>
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 bg-black/60 text-white text-xs rounded-full backdrop-blur-sm">{r.siteName}</span>
        </div>
      </a>
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Clickable title */}
        <a href={r.link} target="_blank" rel="noopener noreferrer"
          className="font-semibold text-foreground text-sm leading-snug line-clamp-2 hover:text-brand-orange transition-colors">
          {r.title}
        </a>
        {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
        {dateStr && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{dateStr}</span>
          </div>
        )}
        <div className="mt-auto pt-2">
          <ImportButton isImported={isImported} isImporting={isImporting} onImport={onImport} onView={onView} />
        </div>
      </div>
    </div>
  );
}

function ImportButton({ isImported, isImporting, onImport, onView }: {
  isImported: boolean; isImporting: boolean; onImport: () => void; onView: () => void;
}) {
  return (
    <button
      onClick={isImported ? onView : onImport}
      disabled={isImporting}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors",
        isImported
          ? "bg-green-500/15 text-green-400 border border-green-500/20 cursor-default"
          : "bg-brand-orange hover:bg-brand-orange-dark text-black"
      )}
    >
      {isImporting ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Importing…</>
      ) : isImported ? (
        <><Check className="w-3.5 h-3.5" />View in Library</>
      ) : (
        <><Plus className="w-3.5 h-3.5" />Import to Library</>
      )}
    </button>
  );
}
