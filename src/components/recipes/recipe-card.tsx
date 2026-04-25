"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Clock, ChefHat } from "lucide-react";
import { cn, formatTime, difficultyLabel, difficultyColor } from "@/lib/utils";
import { useState } from "react";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    imageUrl?: string | null;
    prepTime?: number | null;
    cookTime?: number | null;
    difficulty: string;
    rating?: number | null;
    isFavorite: boolean;
    tags: string[];
    servings: number;
  };
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
}

export function RecipeCard({ recipe, onFavoriteToggle }: RecipeCardProps) {
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorite);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteLoading(true);
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await fetch(`/api/recipes/${recipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      onFavoriteToggle?.(recipe.id, next);
    } catch {
      setIsFavorite(!next); // revert
    } finally {
      setFavoriteLoading(false);
    }
  }

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-brand-orange/40 transition-all duration-200 hover:shadow-lg hover:shadow-black/20">
        {/* Image */}
        <div className="relative aspect-video bg-secondary overflow-hidden">
          {recipe.imageUrl ? (
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChefHat className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Favorite button */}
          <button
            onClick={handleFavorite}
            disabled={favoriteLoading}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={cn(
                "w-4 h-4 transition-colors",
                isFavorite ? "fill-red-400 text-red-400" : "text-white/70"
              )}
            />
          </button>

          {/* Difficulty badge */}
          <div className="absolute bottom-2 left-2">
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm",
                difficultyColor(recipe.difficulty)
              )}
            >
              {difficultyLabel(recipe.difficulty)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-medium text-foreground text-sm leading-snug line-clamp-2 mb-2">
            {recipe.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(totalTime)}
              </span>
            )}
            {recipe.rating && (
              <span className="flex items-center gap-1">
                ★ {recipe.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
