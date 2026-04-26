"use client";

import { useState } from "react";
import Link from "next/link";
import { Link as LinkIcon, Camera, ArrowRight, CalendarDays, Clock, ExternalLink } from "lucide-react";
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

interface MealPlanItem {
  id: string;
  dayOfWeek: number | null;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  recipe: { id: string; title: string; totalTime: number | null };
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
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "photo">("url");

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
          <input
            type="url"
            placeholder="Paste a recipe URL and press Enter..."
            className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  // Trigger import
                  fetch("/api/recipes/scrape", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: val }),
                  }).then(() => window.location.reload());
                }
              }
            }}
          />
          <button
            onClick={() => { setImportTab("photo"); setImportOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-brand-orange hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Scan Photo
          </button>
        </div>
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
