"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Camera, Search, ChevronDown, ChevronUp, BookOpen, X } from "lucide-react";
import { RecipeCard } from "./recipe-card";
import { ImportRecipeModal } from "./import-recipe-modal";
import { CatIcon } from "@/components/ui/cat-icon";
import { cn } from "@/lib/utils";

interface Recipe {
  id: string;
  title: string;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  difficulty: string;
  rating: number | null;
  isFavorite: boolean;
  tags: string[];
  servings: number;
  importedAt: Date;
  sourceName: string | null;
  collection: string | null;
}

interface Filters {
  q?: string;
  difficulty?: string;
  favorite?: string;
  sort?: string;
  mealType?: string;
  timeRange?: string;
  foodGroup?: string;
  collection?: string;
  protein?: string;
  ingredient?: string;
}

interface Props {
  recipes: Recipe[];
  currentFilters: Filters;
  cookbooks: string[];
  overlapMap?: Record<string, number | null>;
}

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest" },
  { value: "oldest",   label: "Oldest" },
  { value: "name",     label: "A–Z" },
  { value: "rating",   label: "Highest Rated" },
  { value: "fastest",  label: "Fastest" },
  { value: "last_made",  label: "Recently Made" },
  { value: "most_made",  label: "Most Made" },
];

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "dinner",    label: "Dinner" },
  { value: "snack",     label: "Snack / Side" },
];

const TIME_RANGES = [
  { value: "under20", label: "Under 20 min" },
  { value: "20to30",  label: "20–30 min" },
  { value: "30to45",  label: "30–45 min" },
  { value: "45plus",  label: "45 min+" },
];

const DIFFICULTIES = [
  { value: "EASY",   label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD",   label: "Hard" },
];

const FOOD_GROUPS = [
  { value: "vegan",        label: "Vegan" },
  { value: "vegetarian",   label: "Vegetarian" },
  { value: "gluten-free",  label: "Gluten-Free" },
  { value: "dairy-free",   label: "Dairy-Free" },
  { value: "high-protein", label: "High Protein" },
  { value: "paleo",        label: "Paleo" },
  { value: "keto",         label: "Keto / Low Carb" },
];

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border whitespace-nowrap",
        active
          ? "bg-brand-orange/15 border-brand-orange/40 text-brand-orange"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {label}
    </button>
  );
}

export function RecipeLibraryClient({ recipes, currentFilters, cookbooks, overlapMap }: Props) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);

  // Auto-apply the user's dietary default when no filters are active
  useEffect(() => {
    const hasFilters = !!(
      currentFilters.q || currentFilters.difficulty || currentFilters.favorite ||
      currentFilters.mealType || currentFilters.timeRange || currentFilters.foodGroup ||
      currentFilters.collection || currentFilters.protein || currentFilters.ingredient
    );
    if (!hasFilters) {
      try {
        const dflt = localStorage.getItem("mauisKitchen_dietaryDefault") ?? "";
        if (dflt) {
          router.replace(`/recipes?foodGroup=${encodeURIComponent(dflt)}`);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilters]);
  const [importTab, setImportTab] = useState<"url" | "photo">("url");
  const [search, setSearch] = useState(currentFilters.q ?? "");
  const [ingredientSearch, setIngredientSearch] = useState(currentFilters.ingredient ?? "");
  const [filtersOpen, setFiltersOpen] = useState(
    !!(currentFilters.mealType || currentFilters.timeRange || currentFilters.foodGroup ||
       currentFilters.difficulty || currentFilters.ingredient)
  );

  function applyFilter(key: string, value: string | null) {
    const current: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentFilters)) {
      if (v != null) current[k] = v;
    }
    const params = new URLSearchParams(current);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/recipes?${params.toString()}`);
  }

  function toggle(key: string, value: string) {
    applyFilter(key, currentFilters[key as keyof Filters] === value ? null : value);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("q", search || null);
  }

  function handleIngredientSearch(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("ingredient", ingredientSearch.trim() || null);
  }

  function handleIngredientChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setIngredientSearch(val);
    if (!val.trim() && currentFilters.ingredient) {
      applyFilter("ingredient", null);
    }
  }

  const activeFilterCount = [
    currentFilters.mealType,
    currentFilters.timeRange,
    currentFilters.foodGroup,
    currentFilters.difficulty,
    currentFilters.favorite,
    currentFilters.collection,
    currentFilters.protein,
    currentFilters.ingredient,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">My Recipes</h1>
        <div className="flex items-center gap-2">
          {/* Scan photo — icon only so the URL button gets more room */}
          <button
            onClick={() => { setImportTab("photo"); setImportOpen(true); }}
            title="Scan a recipe photo"
            className="flex items-center justify-center bg-secondary hover:bg-brand-orange/10 border border-border hover:border-brand-orange/40 text-foreground hover:text-brand-orange p-2.5 rounded-lg transition-colors shrink-0"
          >
            <Camera className="w-4 h-4" />
          </button>
          {/* Import from URL */}
          <button
            onClick={() => { setImportTab("url"); setImportOpen(true); }}
            title="Import from a recipe URL"
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold px-3 py-2.5 rounded-lg transition-colors text-sm"
          >
            <LinkIcon className="w-4 h-4" />
            <span>From URL</span>
          </button>
        </div>
      </div>

      {/* Search + sort row */}
      <div className="flex gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
          />
        </form>

        <select
          value={currentFilters.sort ?? "newest"}
          onChange={(e) => applyFilter("sort", e.target.value)}
          className="bg-card border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 shrink-0"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Filter toggle — icon + count only, no text label */}
        <button
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
          {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expandable filter panel */}
      {filtersOpen && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">

          {/* Ingredient search */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Search by Ingredient</p>
            <form onSubmit={handleIngredientSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={ingredientSearch}
                onChange={handleIngredientChange}
                placeholder="e.g. chicken, garlic, lemon…"
                className="w-full bg-background border border-border rounded-lg pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
              />
              {ingredientSearch && (
                <button
                  type="button"
                  onClick={() => { setIngredientSearch(""); applyFilter("ingredient", null); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear ingredient search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>

          {/* Cookbooks */}
          {cookbooks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Cookbook
              </p>
              <div className="flex flex-wrap gap-2">
                {cookbooks.map((cb) => (
                  <FilterChip
                    key={cb}
                    label={cb}
                    active={currentFilters.collection === cb}
                    onClick={() => toggle("collection", cb)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Meal Type */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Meal Type</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((mt) => (
                <FilterChip
                  key={mt.value}
                  label={mt.label}
                  active={currentFilters.mealType === mt.value}
                  onClick={() => toggle("mealType", mt.value)}
                />
              ))}
            </div>
          </div>

          {/* Total Time */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Total Time</p>
            <div className="flex flex-wrap gap-2">
              {TIME_RANGES.map((tr) => (
                <FilterChip
                  key={tr.value}
                  label={tr.label}
                  active={currentFilters.timeRange === tr.value}
                  onClick={() => toggle("timeRange", tr.value)}
                />
              ))}
            </div>
          </div>

          {/* Food Groups */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Food Groups & Diet</p>
            <div className="flex flex-wrap gap-2">
              {FOOD_GROUPS.map((fg) => (
                <FilterChip
                  key={fg.value}
                  label={fg.label}
                  active={currentFilters.foodGroup === fg.value}
                  onClick={() => toggle("foodGroup", fg.value)}
                />
              ))}
            </div>
          </div>

          {/* Protein */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Protein (per serving)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "high",   label: ">10g" },
                { value: "medium", label: "5–10g" },
                { value: "low",    label: "<5g" },
              ].map((p) => (
                <FilterChip
                  key={p.value}
                  label={p.label}
                  active={currentFilters.protein === p.value}
                  onClick={() => toggle("protein", p.value)}
                />
              ))}
            </div>
          </div>

          {/* Difficulty + Favorites */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1 border-t border-border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <FilterChip
                    key={d.value}
                    label={d.label}
                    active={currentFilters.difficulty === d.value}
                    onClick={() => toggle("difficulty", d.value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-end pb-0.5">
              <FilterChip
                label="♥ Favorites only"
                active={currentFilters.favorite === "true"}
                onClick={() => toggle("favorite", "true")}
              />
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => router.push("/recipes")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active filter summary */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {currentFilters.ingredient && (
            <span className="flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full">
              <Search className="w-3 h-3" />
              {currentFilters.ingredient}
              <button
                onClick={() => { setIngredientSearch(""); applyFilter("ingredient", null); }}
                className="ml-0.5 hover:opacity-70 p-0.5"
                aria-label="Remove ingredient filter"
              >×</button>
            </span>
          )}
          {currentFilters.collection && (
            <span className="flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full">
              <BookOpen className="w-3 h-3" />
              {currentFilters.collection}
              <button
                onClick={() => applyFilter("collection", null)}
                className="ml-0.5 hover:opacity-70 p-0.5"
                aria-label="Remove cookbook filter"
              >×</button>
            </span>
          )}
          {currentFilters.protein && (
            <span className="flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-orange/15 border border-brand-orange/40 text-brand-orange text-xs font-medium rounded-full">
              Protein {{ high: ">10g", medium: "5–10g", low: "<5g" }[currentFilters.protein]}
              <button
                onClick={() => applyFilter("protein", null)}
                className="ml-0.5 hover:opacity-70 p-0.5"
                aria-label="Remove protein filter"
              >×</button>
            </span>
          )}
          <p className="text-sm text-muted-foreground">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} found
          </p>
        </div>
      )}

      {/* Grid */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <CatIcon className="w-16 h-16 text-muted-foreground/20" />
          <div>
            <p className="text-foreground font-medium">
              {activeFilterCount > 0 ? "No recipes match these filters" : "No recipes yet"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {currentFilters.ingredient && activeFilterCount === 1
                ? `No recipes found with "${currentFilters.ingredient}" in their ingredient list. Try the main search bar to search by title too.`
                : activeFilterCount > 0
                ? "Try removing some filters or import more recipes"
                : "Import your first recipe from a URL or screenshot"}
            </p>
          </div>
          {activeFilterCount > 0 ? (
            <button
              onClick={() => router.push("/recipes")}
              className="text-sm text-brand-orange hover:text-brand-orange-light transition-colors font-medium mt-1"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={() => { setImportTab("url"); setImportOpen(true); }}
              className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              <LinkIcon className="w-4 h-4" />
              Import Recipe
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} overlapPercent={overlapMap?.[recipe.id] ?? null} />
          ))}
        </div>
      )}

      <ImportRecipeModal open={importOpen} onClose={() => setImportOpen(false)} initialTab={importTab} />
    </div>
  );
}
