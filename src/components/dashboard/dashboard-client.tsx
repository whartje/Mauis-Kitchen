"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
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

interface Props {
  recentRecipes: RecipeSummary[];
  recipeCount: number;
}

export function DashboardClient({ recentRecipes, recipeCount }: Props) {
  const [importOpen, setImportOpen] = useState(false);

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
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Import Recipe
        </button>
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
            onClick={() => setImportOpen(true)}
            className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            From Photo
          </button>
        </div>
      </div>

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
              action: () => setImportOpen(true),
            },
            {
              title: "Import from Photo",
              desc: "Take a photo of a cookbook page or screenshot a recipe website.",
              action: () => setImportOpen(true),
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

      <ImportRecipeModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
