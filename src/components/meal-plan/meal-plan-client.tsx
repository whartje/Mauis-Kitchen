"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Unlock, X, Plus, ChevronLeft, ChevronRight, Clock, ExternalLink, Minus, Users } from "lucide-react";
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
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snack" },
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
  const [people, setPeople] = useState(2);

  const overlap = computeIngredientOverlap(
    plan.items.map((item) => ({ ingredients: item.recipe.ingredients }))
  );

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
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border",
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
          {MEAL_TYPES.map(({ value: mealType, label }, rowIdx) => (
            <div
              key={mealType}
              className={cn(
                "grid grid-cols-[110px_repeat(7,1fr)]",
                rowIdx < MEAL_TYPES.length - 1 && "border-b border-border"
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
        </div>
      </div>

      {/* Shared ingredients */}
      {overlap.sharedIngredients.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold text-foreground mb-2">
            Shared Ingredients
            <span className="ml-2 font-normal text-muted-foreground">
              — used in multiple recipes this week
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {overlap.sharedIngredients.slice(0, 24).map((ing) => (
              <span
                key={ing}
                className="px-2.5 py-1 bg-brand-orange/10 text-brand-orange text-xs rounded-full capitalize"
              >
                {ing}
              </span>
            ))}
            {overlap.sharedIngredients.length > 24 && (
              <span className="px-2.5 py-1 bg-secondary text-muted-foreground text-xs rounded-full">
                +{overlap.sharedIngredients.length - 24} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Weekly nutrition summary */}
      <WeeklyNutritionPanel items={plan.items} people={people} setPeople={setPeople} />

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
  { key: "iron",     label: "Iron",     unit: "mg",   color: "text-red-400",    decimals: 1 },
];

function fmt(val: number, decimals: number): string {
  return decimals === 0 ? String(Math.round(val)) : val.toFixed(decimals).replace(/\.0$/, "");
}

function WeeklyNutritionPanel({
  items,
  people,
  setPeople,
}: {
  items: PlanItem[];
  people: number;
  setPeople: (n: number) => void;
}) {
  const recipesWithNutrition = items.filter((it) => it.recipe.nutrition);
  if (recipesWithNutrition.length === 0) return null;

  // Sum across all plan items — each item's nutrition is per-serving of that recipe,
  // and each plan item represents `item.servings` servings.
  const weekTotals: Record<string, number> = {};
  let hasEstimated = false;

  for (const item of recipesWithNutrition) {
    const n = item.recipe.nutrition!;
    // item.servings = how many servings the meal plan slot is set to
    // recipe.servings is the base serving count the nutrition is defined for
    // The nutrition is already per-serving, so multiply by item.servings
    const factor = item.servings ?? 4;
    if (n.isEstimated) hasEstimated = true;
    for (const { key } of NUTRITION_FIELDS) {
      const val = n[key];
      if (typeof val === "number") {
        weekTotals[key] = (weekTotals[key] ?? 0) + val * factor;
      }
    }
  }

  const recipeCount = recipesWithNutrition.length;
  const totalRecipes = items.length;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Weekly Nutrition</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recipeCount < totalRecipes
              ? `${recipeCount} of ${totalRecipes} recipes have nutrition data`
              : `All ${totalRecipes} recipes`}
            {hasEstimated && " · includes AI estimates"}
          </p>
        </div>

        {/* People adjuster */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">People:</span>
          <button
            onClick={() => setPeople(Math.max(1, people - 1))}
            className="w-7 h-7 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-semibold w-5 text-center">{people}</span>
          <button
            onClick={() => setPeople(people + 1)}
            className="w-7 h-7 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Row 1 — Week total */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Week Total
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {NUTRITION_FIELDS.map(({ key, label, unit, color, decimals }) => {
            const val = weekTotals[key];
            if (val == null) return null;
            return (
              <div key={key} className="flex flex-col items-center text-center bg-secondary/50 rounded-lg px-2 py-3 gap-1">
                <span className={`text-base font-bold leading-none ${color}`}>
                  {fmt(val, decimals)}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{unit}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Row 2 — Per person */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Per Person · {people} {people === 1 ? "person" : "people"}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {NUTRITION_FIELDS.map(({ key, label, unit, color, decimals }) => {
            const val = weekTotals[key];
            if (val == null) return null;
            const perPerson = val / people;
            return (
              <div key={key} className="flex flex-col items-center text-center bg-secondary/30 rounded-lg px-2 py-3 gap-1">
                <span className={`text-base font-bold leading-none ${color}`}>
                  {fmt(perPerson, decimals)}
                </span>
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

function RecipeSlotCard({
  item,
  onRemove,
  onToggleLock,
}: {
  item: PlanItem;
  onRemove: () => void;
  onToggleLock: () => void;
}) {
  return (
    <div
      className={cn(
        "relative h-full min-h-[90px] rounded-lg p-2.5 flex flex-col gap-1.5 group/card",
        item.isLocked
          ? "bg-brand-orange/10 border border-brand-orange/30"
          : "bg-secondary border border-border"
      )}
    >
      {/* Action buttons */}
      <div className="absolute top-1.5 right-1.5 flex gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          className="p-1 rounded hover:bg-black/20 transition-colors"
          title={item.isLocked ? "Unlock" : "Lock"}
        >
          {item.isLocked ? (
            <Lock className="w-3 h-3 text-brand-orange" />
          ) : (
            <Unlock className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          )}
        </button>
        {!item.isLocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded hover:bg-black/20 transition-colors"
            title="Remove"
          >
            <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Clickable recipe title */}
      <Link
        href={`/recipes/${item.recipe.id}`}
        className="text-xs font-medium text-foreground leading-tight line-clamp-2 pr-10 hover:text-brand-orange transition-colors group/link flex items-start gap-1"
        title={`View ${item.recipe.title}`}
      >
        <span>{item.recipe.title}</span>
        <ExternalLink className="w-2.5 h-2.5 shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-60 transition-opacity" />
      </Link>

      {/* Time */}
      {item.recipe.totalTime != null && (
        <div className="flex items-center gap-1 mt-auto">
          <Clock className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {item.recipe.totalTime}m
          </span>
        </div>
      )}
    </div>
  );
}
