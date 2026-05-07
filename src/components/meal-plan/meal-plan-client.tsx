"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Unlock, X, Plus, ChevronLeft, ChevronRight, Clock, ExternalLink, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeIngredientOverlap, type OverlapLevel } from "@/lib/overlap";
import { RecipePickerDrawer, type RecipeForPicker } from "./recipe-picker-drawer";

type MealTypeEnum = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

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

interface RecipeWithNutrition extends RecipeForPicker {
  nutrition: NutritionFact | null;
  servings?: number;
}

interface PlanItem {
  id: string;
  dayOfWeek: number | null;
  mealType: MealTypeEnum;
  isLocked: boolean;
  servings: number;
  recipe: RecipeWithNutrition;
}

interface Plan {
  id: string;
  items: PlanItem[];
}

interface Props {
  plan: Plan;
  recipes: RecipeForPicker[];
  weekStart: string; // ISO string — Monday of the displayed week
}

const MEAL_TYPES: { value: MealTypeEnum; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "SNACK", label: "Snack" },
  { value: "DINNER", label: "Dinner" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(isoStr: string, days: number): Date {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDate(date: Date): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function fmtWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = addDays(weekStart, 6);
  return `${fmtDate(start)} – ${fmtDate(end)}, ${end.getUTCFullYear()}`;
}

const OVERLAP_STYLE: Record<OverlapLevel, string> = {
  Low: "text-muted-foreground bg-secondary border-border",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  High: "text-green-400 bg-green-400/10 border-green-400/20",
};

export function MealPlanClient({ plan: initialPlan, recipes, weekStart }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [pickerSlot, setPickerSlot] = useState<{
    dayOfWeek: number;
    mealType: MealTypeEnum;
  } | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  // Score uses all items (including duplicate recipes) — intentional
  const overlap = computeIngredientOverlap(
    plan.items.map((item) => ({ ingredients: item.recipe.ingredients }))
  );

  // Shared ingredients display: only ingredients shared across *distinct* recipes
  const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();
  const distinctRecipeIngredients = (() => {
    const seen = new Set<string>();
    return plan.items
      .filter((item) => {
        if (seen.has(item.recipe.id)) return false;
        seen.add(item.recipe.id);
        return true;
      })
      .map((item) => ({ ingredients: item.recipe.ingredients }));
  })();
  const sharedAcrossDistinct = (() => {
    if (distinctRecipeIngredients.length < 2) return [];
    const counts = new Map<string, number>();
    for (const recipe of distinctRecipeIngredients) {
      const recipeIngredients = new Set(recipe.ingredients.map((i) => normalize(i.name)));
      for (const ing of recipeIngredients) {
        counts.set(ing, (counts.get(ing) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
      .sort();
  })();

  function getSlotItem(dayOfWeek: number, mealType: MealTypeEnum): PlanItem | null {
    return (
      plan.items.find(
        (item) => item.dayOfWeek === dayOfWeek && item.mealType === mealType
      ) ?? null
    );
  }

  async function addRecipe(recipeId: string) {
    if (!pickerSlot) return;
    const { dayOfWeek, mealType } = pickerSlot;

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const tempId = `temp-${Date.now()}`;
    const newItem: PlanItem = {
      id: tempId,
      dayOfWeek,
      mealType,
      isLocked: false,
      servings: 4,
      recipe: { ...recipe, nutrition: null },
    };

    setPlan((p) => ({
      ...p,
      items: [
        ...p.items.filter(
          (i) => !(i.dayOfWeek === dayOfWeek && i.mealType === mealType)
        ),
        newItem,
      ],
    }));
    setPickerSlot(null);

    const res = await fetch(`/api/meal-plan/${plan.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId, dayOfWeek, mealType }),
    });
    if (res.ok) {
      const item: PlanItem = await res.json();
      setPlan((p) => ({
        ...p,
        items: [...p.items.filter((i) => i.id !== tempId), item],
      }));
    }
  }

  async function removeItem(item: PlanItem) {
    if (item.isLocked || pending.has(item.id)) return;
    setPlan((p) => ({ ...p, items: p.items.filter((i) => i.id !== item.id) }));
    await fetch(`/api/meal-plan/${plan.id}/items/${item.id}`, {
      method: "DELETE",
    });
  }

  async function patchServings(itemId: string, servings: number) {
    setPlan((p) => ({
      ...p,
      items: p.items.map((i) => i.id === itemId ? { ...i, servings } : i),
    }));
    await fetch(`/api/meal-plan/${plan.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servings }),
    });
  }

  async function toggleLock(item: PlanItem) {
    if (pending.has(item.id)) return;
    setPending((s) => new Set([...s, item.id]));

    const newLocked = !item.isLocked;
    setPlan((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === item.id ? { ...i, isLocked: newLocked } : i
      ),
    }));

    await fetch(`/api/meal-plan/${plan.id}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: newLocked }),
    });
    setPending((s) => {
      const ns = new Set(s);
      ns.delete(item.id);
      return ns;
    });
  }

  function goWeek(dir: 1 | -1) {
    const next = addDays(weekStart, dir * 7);
    router.push(`/meal-plan?week=${next.toISOString().split("T")[0]}`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Meal Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmtWeekRange(weekStart)}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Ingredient Reuse badge */}
          {plan.items.length >= 2 && (
            <div
              title="How much your meals share ingredients. Higher reuse means fewer unique items to buy — great for efficient shopping."
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border cursor-help",
                OVERLAP_STYLE[overlap.level]
              )}
            >
              Ingredient Reuse:{" "}
              <span className="font-semibold">{overlap.level}</span>
              <span className="ml-1.5 opacity-70">
                ({Math.round(overlap.score * 100)}%)
              </span>
            </div>
          )}

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goWeek(-1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/meal-plan")}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              This Week
            </button>
            <button
              onClick={() => goWeek(1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[900px]">
          {/* Day header row */}
          <div className="grid grid-cols-[110px_repeat(7,1fr)] border-b border-border bg-secondary/30">
            <div className="p-3" />
            {DAY_LABELS.map((day, i) => {
              const date = addDays(weekStart, i);
              return (
                <div
                  key={day}
                  className="p-3 text-center border-l border-border"
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {day}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {date.getUTCDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Meal type rows */}
          {MEAL_TYPES.map(({ value: mealType, label }) => (
            <div
              key={mealType}
              className={cn(
                "grid grid-cols-[110px_repeat(7,1fr)] border-b border-border",
              )}
            >
              {/* Meal type label */}
              <div className="p-3 flex items-center border-r border-border bg-secondary/10">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
              </div>

              {/* Day slots */}
              {DAY_LABELS.map((_, dayIdx) => {
                const item = getSlotItem(dayIdx, mealType);
                return (
                  <div
                    key={dayIdx}
                    className="p-2 border-l border-border min-h-[110px]"
                  >
                    {item ? (
                      <RecipeSlotCard
                        item={item}
                        onRemove={() => removeItem(item)}
                        onToggleLock={() => toggleLock(item)}
                        onServingsChange={(s) => patchServings(item.id, s)}
                      />
                    ) : (
                      <button
                        onClick={() =>
                          setPickerSlot({ dayOfWeek: dayIdx, mealType })
                        }
                        className="w-full h-full min-h-[90px] rounded-lg border border-dashed border-border hover:border-brand-orange/50 hover:bg-brand-orange/5 flex items-center justify-center transition-colors group"
                      >
                        <Plus className="w-4 h-4 text-muted-foreground/40 group-hover:text-brand-orange/60 transition-colors" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Daily nutrition totals row */}
          <DailyNutritionRow items={plan.items} />
        </div>
      </div>

      {/* Grid legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-brand-orange" />
          Locked — recipe stays when re-planning
        </span>
        <span className="flex items-center gap-1.5">
          <Unlock className="w-3 h-3" />
          Unlocked — will be replaced when re-planning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/60 inline-block" />
          High ingredient reuse = less to buy
        </span>
      </div>

      {/* Shared ingredients */}
      {sharedAcrossDistinct.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-foreground mb-2">
            Shared Ingredients
            <span className="ml-2 font-normal text-muted-foreground">
              — used in multiple recipes this week
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {sharedAcrossDistinct.slice(0, 24).map((ing) => (
              <span
                key={ing}
                className="px-2.5 py-1 bg-brand-orange/10 text-brand-orange text-xs rounded-full capitalize"
              >
                {ing}
              </span>
            ))}
            {sharedAcrossDistinct.length > 24 && (
              <span className="px-2.5 py-1 bg-secondary text-muted-foreground text-xs rounded-full">
                +{sharedAcrossDistinct.length - 24} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Avg nutrition per serving */}
      <AvgServingNutrition items={plan.items} />

      {/* Suggested recipes with high ingredient overlap */}
      <SuggestedRecipes recipes={recipes} planItems={plan.items} />

      <RecipePickerDrawer
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        slot={pickerSlot}
        recipes={recipes}
        planItems={plan.items}
        onSelect={addRecipe}
      />
    </div>
  );
}

// ─── Daily nutrition totals row ───────────────────────────────────────────────

function DailyNutritionRow({ items }: { items: PlanItem[] }) {
  const dayTotals = Array.from({ length: 7 }, (_, dayIdx) => {
    const dayItems = items.filter((it) => it.dayOfWeek === dayIdx && it.recipe.nutrition);
    if (dayItems.length === 0) return { cal: null, protein: null, carbs: null, hasData: false };
    let cal = 0, protein = 0, carbs = 0;
    for (const item of dayItems) {
      const n = item.recipe.nutrition!;
      const factor = item.servings ?? 4;
      if (n.calories != null) cal += n.calories * factor;
      if (n.protein  != null) protein += n.protein  * factor;
      if (n.carbs    != null) carbs   += n.carbs    * factor;
    }
    return { cal, protein, carbs, hasData: true };
  });

  if (!dayTotals.some((d) => d.hasData)) return null;

  return (
    <div className="grid grid-cols-[110px_repeat(7,1fr)] bg-secondary/20 border-t border-border">

      {/* ── Header label ── */}
      <div className="px-3 pt-2.5 pb-1 border-r border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Daily Total</p>
      </div>
      {dayTotals.map((_, i) => (
        <div key={i} className="border-l border-border px-1 pt-2.5 pb-1" />
      ))}

      {/* ── Calories row ── */}
      <div className="px-3 py-1 border-r border-border flex items-center">
        <span className="text-[10px] text-muted-foreground">Calories</span>
      </div>
      {dayTotals.map((d, i) => (
        <div key={i} className="border-l border-border px-1 py-1 flex items-center justify-center">
          {d.hasData ? (
            <span className="text-[11px] font-semibold text-orange-400 leading-none">
              {Math.round(d.cal!)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/20">—</span>
          )}
        </div>
      ))}

      {/* ── Protein row ── */}
      <div className="px-3 py-1 border-r border-border flex items-center">
        <span className="text-[10px] text-muted-foreground">Protein</span>
      </div>
      {dayTotals.map((d, i) => (
        <div key={i} className="border-l border-border px-1 py-1 flex items-center justify-center">
          {d.hasData ? (
            <span className="text-[11px] font-medium text-blue-400 leading-none">
              {Math.round(d.protein!)}g
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/20">—</span>
          )}
        </div>
      ))}

      {/* ── Carbs row ── */}
      <div className="px-3 pt-1 pb-2.5 border-r border-border flex items-center">
        <span className="text-[10px] text-muted-foreground">Carbs</span>
      </div>
      {dayTotals.map((d, i) => (
        <div key={i} className="border-l border-border px-1 pt-1 pb-2.5 flex items-center justify-center">
          {d.hasData ? (
            <span className="text-[11px] font-medium text-yellow-400 leading-none">
              {Math.round(d.carbs!)}g
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/20">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Weekly nutrition panel ───────────────────────────────────────────────────

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

// ─── Avg. Nutrition per Serving ───────────────────────────────────────────────

function AvgServingNutrition({ items }: { items: PlanItem[] }) {
  const withNutrition = items.filter((it) => it.recipe.nutrition);
  if (withNutrition.length === 0) return null;

  const hasEstimated = withNutrition.some((it) => it.recipe.nutrition!.isEstimated);

  // Average the per-serving nutrition values across all plan slots with data
  const avgValues: Partial<Record<keyof NutritionFact, number>> = {};
  for (const { key } of NUTRITION_FIELDS) {
    const vals = withNutrition
      .map((it) => it.recipe.nutrition![key])
      .filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      avgValues[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  const totalInPlan = items.length;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Avg. Nutrition per Serving</h2>
      <p className="text-xs text-muted-foreground mb-3">
        {withNutrition.length < totalInPlan
          ? `Based on ${withNutrition.length} of ${totalInPlan} planned recipes`
          : `Based on all ${totalInPlan} planned recipes`}
        {hasEstimated && " · includes AI estimates"}
      </p>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NUTRITION_FIELDS.map(({ key, label, unit, color, decimals }) => {
            const val = avgValues[key];
            if (val == null) return null;
            return (
              <div key={key} className="flex flex-col items-center text-center rounded-lg px-2 py-3 gap-1 bg-secondary/50">
                <span className={`text-base font-bold leading-none ${color}`}>{fmt(val, decimals)}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{unit}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Suggested Recipes with High Ingredient Overlap ──────────────────────────

function SuggestedRecipes({
  recipes,
  planItems,
}: {
  recipes: RecipeForPicker[];
  planItems: PlanItem[];
}) {
  const planRecipeIds = new Set(planItems.map((it) => it.recipe.id));
  const normalizeIng = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

  // Build the full pool of ingredients from the current plan
  const planPool = new Set<string>();
  for (const item of planItems) {
    for (const ing of item.recipe.ingredients) {
      planPool.add(normalizeIng(ing.name));
    }
  }

  if (planPool.size === 0) return null;

  const scored = recipes
    .filter((r) => !planRecipeIds.has(r.id))
    .map((r) => {
      const recipeIngs = r.ingredients.map((i) => normalizeIng(i.name));
      const shared = recipeIngs.filter((ing) => planPool.has(ing));
      const overlapPct = recipeIngs.length > 0
        ? Math.round((shared.length / recipeIngs.length) * 100)
        : 0;
      return { recipe: r, overlapPct, sharedIngs: shared };
    })
    .filter((s) => s.overlapPct > 0)
    .sort((a, b) => b.overlapPct - a.overlapPct)
    .slice(0, 6);

  if (scored.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Suggested Recipes</h2>
      <p className="text-xs text-muted-foreground mb-3">
        High ingredient overlap with this week&apos;s plan — less to buy
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scored.map(({ recipe, overlapPct, sharedIngs }) => {
          const badgeStyle =
            overlapPct >= 60
              ? "text-green-400 bg-green-400/10 border-green-400/20"
              : overlapPct >= 30
              ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
              : "text-muted-foreground bg-secondary border-border";

          return (
            <div
              key={recipe.id}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="text-sm font-medium text-foreground hover:text-brand-orange transition-colors line-clamp-2"
                >
                  {recipe.title}
                </Link>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}
                  title={`${overlapPct}% of this recipe's ingredients are already in your plan`}
                >
                  {overlapPct}%
                </span>
              </div>

              {recipe.totalTime != null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="text-xs">{recipe.totalTime}m</span>
                </div>
              )}

              {sharedIngs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sharedIngs.slice(0, 4).map((ing) => (
                    <span
                      key={ing}
                      className="px-2 py-0.5 bg-brand-orange/10 text-brand-orange text-[10px] rounded-full capitalize"
                    >
                      {ing}
                    </span>
                  ))}
                  {sharedIngs.length > 4 && (
                    <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-[10px] rounded-full">
                      +{sharedIngs.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecipeSlotCard({
  item,
  onRemove,
  onToggleLock,
  onServingsChange,
}: {
  item: PlanItem;
  onRemove: () => void;
  onToggleLock: () => void;
  onServingsChange: (servings: number) => void;
}) {
  return (
    <div
      className={cn(
        "h-full min-h-[90px] rounded-lg p-2.5 flex flex-col gap-1.5 group/card",
        item.isLocked
          ? "bg-brand-orange/10 border border-brand-orange/30"
          : "bg-secondary border border-border"
      )}
    >
      {/* Action buttons — compact row at the top, right-aligned */}
      <div className="flex justify-end gap-0.5 -mt-0.5 -mr-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          className="p-1 rounded hover:bg-black/20 transition-colors"
          title={item.isLocked
            ? "Locked — this recipe stays in place when you re-plan the week. Click to unlock."
            : "Lock this recipe to keep it when re-planning the week."}
        >
          {item.isLocked ? (
            <Lock className="w-3 h-3 text-brand-orange" />
          ) : (
            <Unlock className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          )}
        </button>
        {!item.isLocked && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded hover:bg-black/20 transition-colors"
            title="Remove"
          >
            <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Clickable recipe title — full card width, up to 3 lines */}
      <Link
        href={`/recipes/${item.recipe.id}`}
        className="text-xs font-medium text-foreground leading-tight line-clamp-3 hover:text-brand-orange transition-colors group/link"
        title={`View ${item.recipe.title}`}
      >
        {item.recipe.title}
        <ExternalLink className="inline w-2.5 h-2.5 ml-0.5 opacity-0 group-hover/link:opacity-60 transition-opacity align-baseline" />
      </Link>

      {/* Bottom row: time + servings adjuster */}
      <div className="flex items-center justify-between mt-auto gap-1">
        {item.recipe.totalTime != null ? (
          <div className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{item.recipe.totalTime}m</span>
          </div>
        ) : <span />}

        {/* Servings stepper */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onServingsChange(Math.max(1, item.servings - 1)); }}
            className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/20 transition-colors"
            title="Fewer servings"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="text-[10px] text-muted-foreground w-5 text-center font-medium">
            {item.servings}×
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onServingsChange(item.servings + 1); }}
            className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/20 transition-colors"
            title="More servings"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
