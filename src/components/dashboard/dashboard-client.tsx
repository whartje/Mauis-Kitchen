"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Camera, ArrowRight, CalendarDays, Clock, ExternalLink, Minus, Plus as PlusIcon, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { ImportRecipeModal } from "@/components/recipes/import-recipe-modal";

interface RecipeSummary {
  id: string;
  title: string;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  difficulty: string;
  rating: number | null;
  isFavorite: boolean;
  tags: string[];
  servings: number;
}

interface NutritionFact {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  iron: number | null;
  isEstimated: boolean;
}

interface MealPlanItem {
  id: string;
  dayOfWeek: number | null;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  servings: number;
  recipe: { id: string; title: string; totalTime: number | null; servings: number; nutrition: NutritionFact | null };
}

interface Props {
  recentRecipes: RecipeSummary[];
  recipeCount: number;
  weekStart: string;
  mealPlanItems: MealPlanItem[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};
const MEAL_ORDER: Record<string, number> = {
  BREAKFAST: 0, LUNCH: 1, DINNER: 2, SNACK: 3,
};

function addDays(isoStr: string, days: number): Date {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDate(date: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function DashboardClient({ recentRecipes, recipeCount, weekStart, mealPlanItems }: Props) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "photo">("url");
  const [people, setPeople] = useState(2);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickSuccess, setQuickSuccess] = useState<string | null>(null);

  async function handleQuickImport() {
    const val = quickUrl.trim();
    if (!val || quickLoading) return;
    setQuickLoading(true);
    setQuickError(null);
    setQuickSuccess(null);
    try {
      const res = await fetch("/api/recipes/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message ?? (res.status === 409 ? "You already have this recipe." : "Import failed. Check the URL and try again.");
        if (res.status === 409 && data?.error?.existingId) {
          router.push(`/recipes/${data.error.existingId}`);
        } else {
          setQuickError(msg);
        }
      } else {
        setQuickUrl("");
        setQuickSuccess(data.title ?? "Recipe imported!");
        setTimeout(() => router.push(`/recipes/${data.id}`), 800);
      }
    } catch {
      setQuickError("Something went wrong. Check your connection and try again.");
    } finally {
      setQuickLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome / quick import */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {recipeCount > 0
              ? `${recipeCount} recipe${recipeCount !== 1 ? "s" : ""} in your kitchen`
              : "Your kitchen is empty — import a recipe to get started"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setImportTab("photo"); setImportOpen(true); }}
            title="Scan a recipe photo"
            className="flex items-center gap-2 bg-secondary hover:bg-brand-orange/10 border border-border hover:border-brand-orange/40 text-foreground hover:text-brand-orange px-3 py-2.5 rounded-lg transition-colors text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Photo</span>
          </button>
          <button
            onClick={() => { setImportTab("url"); setImportOpen(true); }}
            title="Import from a recipe URL"
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold px-3 py-2.5 rounded-lg transition-colors text-sm"
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">From URL</span>
          </button>
        </div>
      </div>

      {/* Quick import bar */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-foreground mb-3">Quick Import</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => { setQuickUrl(e.target.value); setQuickError(null); setQuickSuccess(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuickImport(); }}
              placeholder="Paste a recipe URL and press Enter..."
              disabled={quickLoading}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition disabled:opacity-60"
            />
            {quickLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-orange animate-spin" />
            )}
            {quickSuccess && !quickLoading && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
            )}
          </div>
          <button
            onClick={() => { setImportTab("photo"); setImportOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-brand-orange hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Scan Photo
          </button>
        </div>

        {/* Feedback */}
        {quickError && (
          <div className="mt-2 flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {quickError}
          </div>
        )}
        {quickSuccess && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Imported &ldquo;{quickSuccess}&rdquo; — redirecting…
          </div>
        )}
      </div>

      {/* This week's meal plan */}
      {mealPlanItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-orange" />
              This Week&apos;s Meals
            </h2>
            <Link
              href="/meal-plan"
              className="flex items-center gap-1 text-sm text-brand-orange hover:text-brand-orange-light transition-colors"
            >
              Edit plan
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {mealPlanItems
              .slice()
              .sort((a, b) => {
                const dayA = a.dayOfWeek ?? 0;
                const dayB = b.dayOfWeek ?? 0;
                if (dayA !== dayB) return dayA - dayB;
                return (MEAL_ORDER[a.mealType] ?? 0) - (MEAL_ORDER[b.mealType] ?? 0);
              })
              .map((item) => {
                const date = item.dayOfWeek != null ? addDays(weekStart, item.dayOfWeek) : null;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Day + date */}
                    <div className="w-16 shrink-0 text-center">
                      {date ? (
                        <>
                          <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide">
                            {DAY_NAMES[item.dayOfWeek!]}
                          </p>
                          <p className="text-xs text-muted-foreground">{fmtDate(date)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Meal type badge */}
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground w-20 text-center">
                      {MEAL_LABEL[item.mealType]}
                    </span>

                    {/* Recipe link */}
                    <Link
                      href={`/recipes/${item.recipe.id}`}
                      className="flex-1 min-w-0 flex items-center gap-1 group"
                    >
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-brand-orange transition-colors">
                        {item.recipe.title}
                      </span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>

                    {/* Time */}
                    {item.recipe.totalTime != null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        {item.recipe.totalTime}m
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Weekly nutrition */}
          <DashboardNutritionPanel items={mealPlanItems} people={people} setPeople={setPeople} />
        </div>
      )}

      {/* Recent recipes */}
      {recentRecipes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Recipes</h2>
            <Link
              href="/recipes"
              className="flex items-center gap-1 text-sm text-brand-orange hover:text-brand-orange-light transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recipeCount === 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {[
            {
              title: "Import from URL",
              desc: "Paste any recipe website URL — we'll extract and normalize it automatically.",
              action: () => { setImportTab("url"); setImportOpen(true); },
            },
            {
              title: "Scan a Photo",
              desc: "Take a photo of a cookbook page or screenshot a recipe website.",
              action: () => { setImportTab("photo"); setImportOpen(true); },
            },
            {
              title: "Build a Meal Plan",
              desc: "Select recipes and let us optimize your week around shared ingredients.",
              action: undefined,
              href: "/meal-plan",
            },
          ].map((card) => (
            <div key={card.title} className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="font-medium text-foreground">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.desc}</p>
              {card.href ? (
                <Link
                  href={card.href}
                  className="text-sm text-brand-orange hover:text-brand-orange-light transition-colors font-medium"
                >
                  Get started →
                </Link>
              ) : (
                <button
                  onClick={card.action}
                  className="text-sm text-brand-orange hover:text-brand-orange-light transition-colors font-medium"
                >
                  Get started →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ImportRecipeModal open={importOpen} onClose={() => setImportOpen(false)} initialTab={importTab} />
    </div>
  );
}

// ─── Dashboard weekly nutrition panel ─────────────────────────────────────────

const NUTRITION_FIELDS: Array<{
  key: keyof NutritionFact;
  label: string;
  unit: string;
  color: string;
  decimals: number;
}> = [
  { key: "calories", label: "Calories", unit: "kcal", color: "text-orange-400", decimals: 0 },
  { key: "protein",  label: "Protein",  unit: "g",    color: "text-blue-400",   decimals: 1 },
  { key: "carbs",    label: "Carbs",    unit: "g",    color: "text-yellow-400", decimals: 1 },
  { key: "fat",      label: "Fat",      unit: "g",    color: "text-purple-400", decimals: 1 },
  { key: "fiber",    label: "Fiber",    unit: "g",    color: "text-green-400",  decimals: 1 },
  { key: "sugar",    label: "Sugar",    unit: "g",    color: "text-pink-400",   decimals: 1 },
  { key: "sodium",   label: "Sodium",   unit: "mg",   color: "text-cyan-400",   decimals: 0 },
  { key: "iron",     label: "Iron",     unit: "mg",   color: "text-red-400",    decimals: 1 },
];

function fmt(val: number, decimals: number): string {
  return decimals === 0 ? String(Math.round(val)) : val.toFixed(decimals).replace(/\.0$/, "");
}

function NutritionTile({ label, value, unit, color, decimals, dim }: {
  label: string; value: number; unit: string; color: string; decimals: number; dim?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center rounded-lg px-2 py-3 gap-1 ${dim ? "bg-secondary/30" : "bg-secondary/50"}`}>
      <span className={`text-base font-bold leading-none ${color}`}>
        {fmt(value, decimals)}
      </span>
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{unit}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function DashboardNutritionPanel({
  items,
  people,
  setPeople,
}: {
  items: MealPlanItem[];
  people: number;
  setPeople: (n: number) => void;
}) {
  const withNutrition = items.filter((it) => it.recipe.nutrition);
  if (withNutrition.length === 0) return null;

  // Sum totals — each plan item's nutrition is per recipe serving; multiply by item.servings
  const totals: Partial<Record<keyof NutritionFact, number>> = {};
  let hasEstimated = false;
  for (const item of withNutrition) {
    const n = item.recipe.nutrition!;
    if (n.isEstimated) hasEstimated = true;
    const factor = item.servings ?? item.recipe.servings ?? 4;
    for (const { key } of NUTRITION_FIELDS) {
      const val = n[key];
      if (typeof val === "number") {
        totals[key] = (totals[key] ?? 0) + val * factor;
      }
    }
  }

  const hasAny = NUTRITION_FIELDS.some(({ key }) => totals[key] != null);
  if (!hasAny) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 mt-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Weekly Nutrition</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {withNutrition.length < items.length
              ? `${withNutrition.length} of ${items.length} recipes have data`
              : `${items.length} recipes`}
            {hasEstimated && " · AI estimates"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">People:</span>
          <button
            onClick={() => setPeople(Math.max(1, people - 1))}
            className="w-6 h-6 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-semibold w-4 text-center">{people}</span>
          <button
            onClick={() => setPeople(people + 1)}
            className="w-6 h-6 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Week total */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Week Total</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NUTRITION_FIELDS.map(({ key, label, unit, color, decimals }) => {
            const val = totals[key];
            if (val == null) return null;
            return <NutritionTile key={key} label={label} value={val} unit={unit} color={color} decimals={decimals} />;
          })}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Per person */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Per Person · {people} {people === 1 ? "person" : "people"}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NUTRITION_FIELDS.map(({ key, label, unit, color, decimals }) => {
            const val = totals[key];
            if (val == null) return null;
            return <NutritionTile key={key} label={label} value={val / people} unit={unit} color={color} decimals={decimals} dim />;
          })}
        </div>
      </div>
    </div>
  );
}
