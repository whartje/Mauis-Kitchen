"use client";

import { useState, useMemo } from "react";
import { X, Clock, Search, Sparkles } from "lucide-react";
import Image from "next/image";

export interface RecipeForPicker {
  id: string;
  title: string;
  imageUrl: string | null;
  totalTime: number | null;
  tags: string[];
  ingredients: { name: string }[];
}

type MealTypeEnum = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

interface PlanItemSlim {
  recipe: { ingredients: { name: string }[] };
}

interface Props {
  open: boolean;
  onClose: () => void;
  slot: { dayOfWeek: number; mealType: MealTypeEnum } | null;
  recipes: RecipeForPicker[];
  planItems: PlanItemSlim[];
  onSelect: (recipeId: string) => void;
}

const DAY_LABELS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const MEAL_LABELS: Record<MealTypeEnum, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

function computeSuggestions(
  recipes: RecipeForPicker[],
  planItems: PlanItemSlim[],
  limit = 5
): RecipeForPicker[] {
  if (planItems.length === 0) return [];

  const planIngredients = new Set(
    planItems.flatMap((item) =>
      item.recipe.ingredients.map((ing) => ing.name.toLowerCase().trim())
    )
  );

  return recipes
    .map((r) => ({
      recipe: r,
      overlap: r.ingredients.filter((ing) =>
        planIngredients.has(ing.name.toLowerCase().trim())
      ).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map(({ recipe }) => recipe);
}

export function RecipePickerDrawer({
  open,
  onClose,
  slot,
  recipes,
  planItems,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  const suggestions = useMemo(
    () => computeSuggestions(recipes, planItems),
    [recipes, planItems]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, search]);

  if (!open) return null;

  const slotLabel = slot
    ? `${DAY_LABELS[slot.dayOfWeek]} — ${MEAL_LABELS[slot.mealType]}`
    : "";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Pick a Recipe
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{slotLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
              autoFocus
            />
          </div>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto">
          {recipes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">
                No recipes in your library yet.
              </p>
            </div>
          ) : (
            <>
              {/* Suggested section */}
              {suggestions.length > 0 && !search && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/50 border-b border-border">
                    <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Suggested — high ingredient overlap
                    </span>
                  </div>
                  {suggestions.map((recipe) => (
                    <RecipePickerItem key={recipe.id} recipe={recipe} onSelect={onSelect} />
                  ))}
                  <div className="px-4 py-2.5 border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      All Recipes
                    </span>
                  </div>
                </div>
              )}

              {/* All / filtered recipes */}
              {filtered.map((recipe) => (
                <RecipePickerItem key={recipe.id} recipe={recipe} onSelect={onSelect} />
              ))}

              {filtered.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    No recipes match &ldquo;{search}&rdquo;
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function RecipePickerItem({
  recipe,
  onSelect,
}: {
  recipe: RecipeForPicker;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(recipe.id)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left border-b border-border/50"
    >
      {recipe.imageUrl ? (
        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-secondary">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            width={44}
            height={44}
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className="w-11 h-11 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-lg">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{recipe.title}</p>
        {recipe.totalTime != null && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{recipe.totalTime} min</span>
          </div>
        )}
      </div>
    </button>
  );
}
