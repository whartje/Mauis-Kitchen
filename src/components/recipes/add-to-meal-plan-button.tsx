"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH",     label: "Lunch" },
  { value: "SNACK",     label: "Snack" },
  { value: "DINNER",    label: "Dinner" },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function currentMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function AddToMealPlanButton({ recipeId, servings }: { recipeId: string; servings?: number }) {
  const [open, setOpen] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(currentMonday);
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // 0=Mon…6=Sun
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null); // "DINNER" etc after success
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset state when opening
  function toggle() {
    if (!open) {
      setSelectedDay(null);
      setSaved(null);
      setWeekStart(currentMonday());
    }
    setOpen((v) => !v);
  }

  async function addToMealPlan(mealType: MealType) {
    if (selectedDay === null) return;
    setSaving(true);
    try {
      // Fetch or create the plan for this week
      const planRes = await fetch(`/api/meal-plan?week=${toISO(weekStart)}`);
      if (!planRes.ok) return;
      const plan = await planRes.json();

      await fetch(`/api/meal-plan/${plan.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, dayOfWeek: selectedDay, mealType, servings }),
      });

      setSaved(mealType);
      // Auto-close after a beat
      setTimeout(() => setOpen(false), 1200);
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${MONTHS[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()} – ${MONTHS[weekEnd.getUTCMonth()]} ${weekEnd.getUTCDate()}`;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        title="Add to meal plan"
        className={cn(
          "p-2 rounded-full transition-colors",
          open
            ? "bg-brand-orange/15 text-brand-orange"
            : "hover:bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        <CalendarPlus className="w-6 h-6" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-2xl w-72 p-4 space-y-4">

          {/* Week navigator */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { setWeekStart((w) => addDays(w, -7)); setSelectedDay(null); setSaved(null); }}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-foreground text-center flex-1">{weekLabel}</span>
            <button
              onClick={() => { setWeekStart((w) => addDays(w, 7)); setSelectedDay(null); setSaved(null); }}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, i) => {
              const date = addDays(weekStart, i);
              const isSelected = selectedDay === i;
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedDay(i); setSaved(null); }}
                  className={cn(
                    "flex flex-col items-center rounded-lg py-1.5 px-0.5 transition-colors text-center",
                    isSelected
                      ? "bg-brand-orange text-black"
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-wide leading-none">{name}</span>
                  <span className="text-sm font-bold leading-tight mt-0.5">{date.getUTCDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Meal type buttons — only shown after a day is selected */}
          {selectedDay !== null && (
            <div className="space-y-1.5 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Add to {DAY_NAMES[selectedDay]}&apos;s…
                </p>
                {servings != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {servings} {servings === 1 ? "serving" : "servings"}
                  </span>
                )}
              </div>
              {MEAL_TYPES.map(({ value, label }) => {
                const isSaved = saved === value;
                return (
                  <button
                    key={value}
                    onClick={() => !saving && !saved && addToMealPlan(value)}
                    disabled={saving || !!saved}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                      isSaved
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "hover:bg-brand-orange/10 hover:text-brand-orange text-foreground border border-transparent hover:border-brand-orange/20",
                      "disabled:cursor-default"
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    {saving && !saved ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : isSaved ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
