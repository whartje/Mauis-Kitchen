"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, ChevronLeft, ChevronRight, Check, Loader2, Minus, Plus } from "lucide-react";
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
  const [saved, setSaved] = useState<string | null>(null);
  // Serving count — defaults to the recipe's own serving size, adjustable in the popup
  const [servingCount, setServingCount] = useState(servings ?? 1);

  // Portal setup — mounted guards against SSR, isDesktop drives layout mode
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  // For desktop: position popup relative to the button using bounding rect
  const [desktopPos, setDesktopPos] = useState<{ top: number; right: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // SSR safety + responsive detection
  useEffect(() => {
    setMounted(true);
    const check = () => setIsDesktop(window.innerWidth >= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on outside click (checks both button and popup since popup is in a portal)
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popupRef.current && !popupRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Compute desktop dropdown position from button's screen coordinates
  useEffect(() => {
    if (open && isDesktop && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDesktopPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open, isDesktop]);

  function toggle() {
    if (!open) {
      setSelectedDay(null);
      setSaved(null);
      setWeekStart(currentMonday());
      setServingCount(servings ?? 1); // reset to recipe's default each time
    }
    setOpen((v) => !v);
  }

  async function addToMealPlan(mealType: MealType) {
    if (selectedDay === null) return;
    setSaving(true);
    try {
      const planRes = await fetch(`/api/meal-plan?week=${toISO(weekStart)}`);
      if (!planRes.ok) return;
      const plan = await planRes.json();
      await fetch(`/api/meal-plan/${plan.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, dayOfWeek: selectedDay, mealType, servings: servingCount }),
      });
      setSaved(mealType);
      setTimeout(() => setOpen(false), 1200);
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${MONTHS[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()} – ${MONTHS[weekEnd.getUTCMonth()]} ${weekEnd.getUTCDate()}`;

  // Shared popup content (used by both mobile sheet and desktop dropdown)
  const popupInner = (
    <>
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

      {/* Serving count + meal type — only shown after a day is selected */}
      {selectedDay !== null && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {/* Serving count adjuster */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Servings
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setServingCount((n) => Math.max(1, n - 1))}
                className="w-6 h-6 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-sm font-semibold text-foreground w-6 text-center">
                {servingCount}
              </span>
              <button
                onClick={() => setServingCount((n) => n + 1)}
                className="w-6 h-6 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Add to {DAY_NAMES[selectedDay]}&apos;s…
            </p>
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
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
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

      {/*
       * Portal: renders directly into <body> so it's never clipped or mis-positioned
       * by the overflow-y-auto scroll container in the dashboard layout.
       * On iOS Safari, position:fixed inside an overflow:auto parent doesn't behave
       * as viewport-fixed — the portal bypass fixes this completely.
       */}
      {mounted && open && createPortal(
        <>
          {/* Backdrop — mobile only */}
          {!isDesktop && (
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setOpen(false)}
            />
          )}

          <div
            ref={popupRef}
            className={cn(
              "fixed z-50 bg-card border border-border rounded-xl shadow-2xl p-4 space-y-4 overflow-y-auto",
              isDesktop
                ? "w-72 max-h-[80vh]"
                : "inset-x-4 max-h-[70dvh]"
            )}
            style={
              isDesktop && desktopPos
                ? { top: desktopPos.top, right: desktopPos.right }
                // Mobile: sit above the bottom nav bar (5rem) + iOS home indicator
                : { bottom: "calc(5rem + env(safe-area-inset-bottom) + 0.5rem)" }
            }
          >
            {popupInner}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
