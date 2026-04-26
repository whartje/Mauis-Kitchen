"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, ChefHat, Star, Heart, ExternalLink, Minus, Plus, Camera, Loader2, Pencil, BookOpen, Trash2, Tag, X, NotebookPen, ZoomIn, Sparkles } from "lucide-react";
import { AddToMealPlanButton } from "./add-to-meal-plan-button";
import { overlapColor } from "@/lib/meal-plan-overlap";
import { scaleQuantity } from "@/lib/units";
import { cn, formatTime, difficultyLabel, difficultyColor } from "@/lib/utils";
import type { Ingredient, Instruction, NutritionFact } from "@prisma/client";

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  collection: string | null;
  notes: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  difficulty: string;
  rating: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  isFavorite: boolean;
  tags: string[];
  ingredients: Ingredient[];
  instructions: Instruction[];
  nutrition: NutritionFact | null;
}

interface Props {
  recipe: Recipe;
  overlapPercent?: number | null;
}

export function RecipeDetailClient({ recipe, overlapPercent }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe.ingredients);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [newIngredientId, setNewIngredientId] = useState<string | null>(null);
  const [servings, setServings] = useState(recipe.servings);
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorite);
  const [rating, setRating] = useState(recipe.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Close lightbox on Escape
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") closeLightbox(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, closeLightbox]);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Editable fields ────────────────────────────────────────────────────────
  const [titleValue, setTitleValue] = useState(recipe.title);
  const [descriptionValue, setDescriptionValue] = useState(recipe.description ?? "");
  const [collectionValue, setCollectionValue] = useState(recipe.collection ?? "");
  const [editingField, setEditingField] = useState<"title" | "description" | "collection" | null>(null);
  const [cookbooks, setCookbooks] = useState<string[]>([]);

  // ── Time fields ────────────────────────────────────────────────────────────
  const [prepTime, setPrepTime] = useState<number | null>(recipe.prepTime ?? null);
  const [cookTime, setCookTime] = useState<number | null>(recipe.cookTime ?? null);
  const [totalTime, setTotalTime] = useState<number | null>(recipe.totalTime ?? null);
  const [editingTime, setEditingTime] = useState<"prepTime" | "cookTime" | "totalTime" | null>(null);
  const [timeInputValue, setTimeInputValue] = useState("");

  function startEditingTime(field: "prepTime" | "cookTime" | "totalTime") {
    const current = field === "prepTime" ? prepTime : field === "cookTime" ? cookTime : totalTime;
    setTimeInputValue(current != null ? String(current) : "");
    setEditingTime(field);
  }

  async function saveTime(field: "prepTime" | "cookTime" | "totalTime") {
    setEditingTime(null);
    const parsed = timeInputValue.trim() === "" ? null : parseInt(timeInputValue, 10);
    const value = parsed != null && !isNaN(parsed) ? parsed : null;
    if (field === "prepTime") setPrepTime(value);
    else if (field === "cookTime") setCookTime(value);
    else setTotalTime(value);

    // Auto-update totalTime if both prep and cook are set and totalTime wasn't manually set
    let newTotal = totalTime;
    if (field !== "totalTime") {
      const p = field === "prepTime" ? value : prepTime;
      const c = field === "cookTime" ? value : cookTime;
      if (p != null && c != null) {
        newTotal = p + c;
        setTotalTime(newTotal);
      }
    }

    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [field]: value,
        ...(field !== "totalTime" && newTotal !== totalTime ? { totalTime: newTotal } : {}),
      }),
    });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notesValue, setNotesValue] = useState(recipe.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveNotes() {
    setEditingNotes(false);
    setSavingNotes(true);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue.trim() || null }),
    });
    setSavingNotes(false);
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  const [tags, setTags] = useState<string[]>(recipe.tags);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/cookbooks")
      .then((r) => r.json())
      .then((d) => setCookbooks(d.cookbooks ?? []))
      .catch(() => {});
  }, []);

  const scaleFactor = servings / recipe.servings;

  // ── Nutrition ──────────────────────────────────────────────────────────────
  const [nutrition, setNutrition] = useState(recipe.nutrition);
  const [estimatingNutrition, setEstimatingNutrition] = useState(false);

  async function estimateNutrition() {
    setEstimatingNutrition(true);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/nutrition`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setNutrition(data.nutrition);
      }
    } finally {
      setEstimatingNutrition(false);
    }
  }

  // ── Thumbnail upload ───────────────────────────────────────────────────────
  async function uploadThumbnail(file: File) {
    setUploadingThumbnail(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/recipes/${recipe.id}/thumbnail`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) setImageUrl(data.imageUrl);
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function handleThumbnailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadThumbnail(file);
  }

  // Paste-to-thumbnail: Ctrl+V anywhere on the page pastes the image as thumbnail
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (uploadingThumbnail) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            uploadThumbnail(file);
            e.preventDefault();
            break;
          }
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadingThumbnail]);

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: next }),
    });
  }

  async function handleRate(stars: number) {
    setRating(stars);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: stars }),
    });
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    router.push("/recipes");
    router.refresh();
  }

  async function saveField(field: "title" | "description" | "collection", value: string) {
    setEditingField(null);
    const trimmed = value.trim();
    if (field === "title" && !trimmed) {
      // Revert — title is required
      setTitleValue(recipe.title);
      return;
    }
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: trimmed || null }),
    });
  }

  async function saveTags(newTags: string[]) {
    setTags(newTags);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
  }

  function commitTagInput() {
    const raw = tagInput.trim().replace(/,+$/, "").trim();
    if (!raw) return;
    const newTag = raw.toLowerCase();
    if (!tags.includes(newTag)) {
      const next = [...tags, newTag];
      setTags(next);
      saveTags(next);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    saveTags(next);
  }

  // ── Ingredient editing ─────────────────────────────────────────────────────
  async function saveIngredient(id: string, patch: { name?: string; quantity?: number | null; unit?: string | null }) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await fetch(`/api/recipes/${recipe.id}/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/recipes/${recipe.id}/ingredients/${id}`, { method: "DELETE" });
  }

  async function addIngredient() {
    const res = await fetch(`/api/recipes/${recipe.id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", quantity: null, unit: null }),
    });
    if (res.ok) {
      const ing: Ingredient = await res.json();
      setIngredients((prev) => [...prev, ing]);
      setNewIngredientId(ing.id);
    }
  }

  function renderIngredientQuantity(ing: Ingredient): string {
    const display = ing.name || ing.raw;
    if (ing.quantity == null) return ing.notes ? `${display}, ${ing.notes}` : display;
    const scaled = scaleQuantity(ing.quantity, ing.unit, recipe.servings, servings);
    return `${scaled.display} ${display}${ing.notes ? `, ${ing.notes}` : ""}`;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Back nav */}
      <Link
        href="/recipes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Recipes
      </Link>

      {/* Hero image */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden bg-secondary group",
        imageUrl ? "h-64 md:h-80" : "h-24 border-2 border-dashed border-border"
      )}>
        {imageUrl ? (
          <>
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 z-10 cursor-zoom-in group/zoom"
              aria-label="View full image"
            >
              <div className="absolute inset-0 bg-black/0 group-hover/zoom:bg-black/10 transition-colors" />
              <ZoomIn className="absolute top-3 left-3 w-5 h-5 text-white/0 group-hover/zoom:text-white/80 transition-colors drop-shadow" />
            </button>
            <Image src={imageUrl} alt={titleValue} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {tags.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white/80">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <Camera className="w-4 h-4" />
            No photo yet — upload, take a photo, or press Ctrl+V to paste
          </div>
        )}

        {/* Change thumbnail button */}
        <button
          onClick={() => thumbnailInputRef.current?.click()}
          disabled={uploadingThumbnail}
          className={cn(
            "absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            "bg-black/60 text-white backdrop-blur-sm border border-white/10",
            "hover:bg-black/80",
            imageUrl ? "opacity-0 group-hover:opacity-100" : "opacity-100",
            "disabled:opacity-50"
          )}
        >
          {uploadingThumbnail ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          {uploadingThumbnail ? "Uploading…" : imageUrl ? "Change photo" : "Add photo"}
        </button>

        <input
          ref={thumbnailInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleThumbnailChange}
        />
      </div>

      {/* Title + meta */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          {/* Editable title */}
          {editingField === "title" ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => saveField("title", titleValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveField("title", titleValue); }
                if (e.key === "Escape") { setTitleValue(recipe.title); setEditingField(null); }
              }}
              className="font-display text-3xl text-foreground leading-tight bg-transparent border-b-2 border-brand-orange focus:outline-none flex-1 min-w-0"
            />
          ) : (
            <button
              onClick={() => setEditingField("title")}
              className="font-display text-3xl text-foreground leading-tight text-left flex items-start gap-2 group/title flex-1 min-w-0"
              title="Click to edit title"
            >
              <span>{titleValue}</span>
              <Pencil className="w-4 h-4 mt-1.5 text-muted-foreground/40 group-hover/title:text-muted-foreground shrink-0 transition-colors" />
            </button>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <AddToMealPlanButton recipeId={recipe.id} />
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <Heart className={cn("w-6 h-6", isFavorite ? "fill-red-400 text-red-400" : "text-muted-foreground")} />
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-full hover:bg-red-500/10 transition-colors group"
              >
                <Trash2 className="w-5 h-5 text-muted-foreground group-hover:text-red-400 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Editable description */}
        {editingField === "description" ? (
          <textarea
            autoFocus
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={() => saveField("description", descriptionValue)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setDescriptionValue(recipe.description ?? ""); setEditingField(null); }
            }}
            rows={3}
            placeholder="Add a description…"
            className="w-full text-muted-foreground leading-relaxed bg-transparent border border-border rounded px-3 py-2 focus:outline-none focus:border-brand-orange resize-none text-sm"
          />
        ) : descriptionValue ? (
          <button
            onClick={() => setEditingField("description")}
            className="text-muted-foreground leading-relaxed text-left w-full flex items-start gap-2 group/desc"
            title="Click to edit description"
          >
            <span>{descriptionValue}</span>
            <Pencil className="w-3.5 h-3.5 mt-1 text-muted-foreground/30 group-hover/desc:text-muted-foreground shrink-0 transition-colors" />
          </button>
        ) : (
          <button
            onClick={() => setEditingField("description")}
            className="text-muted-foreground/40 text-sm italic hover:text-muted-foreground transition-colors"
          >
            Add description…
          </button>
        )}

        {/* Stats row — editable time fields */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* Prep time */}
          {editingTime === "prepTime" ? (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Prep</span>
              <input
                autoFocus
                type="number"
                min="0"
                value={timeInputValue}
                onChange={(e) => setTimeInputValue(e.target.value)}
                onBlur={() => saveTime("prepTime")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveTime("prepTime"); }
                  if (e.key === "Escape") setEditingTime(null);
                }}
                placeholder="mins"
                className="w-16 bg-transparent border-b border-brand-orange focus:outline-none text-foreground text-sm text-center"
              />
              <span className="text-muted-foreground text-xs">min</span>
            </div>
          ) : (
            <button
              onClick={() => startEditingTime("prepTime")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group/prep"
              title="Click to edit prep time"
            >
              <Clock className="w-4 h-4" />
              <span>{prepTime != null ? `Prep ${formatTime(prepTime)}` : "Add prep time"}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover/prep:opacity-60 transition-opacity" />
            </button>
          )}

          {/* Cook time */}
          {editingTime === "cookTime" ? (
            <div className="flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Cook</span>
              <input
                autoFocus
                type="number"
                min="0"
                value={timeInputValue}
                onChange={(e) => setTimeInputValue(e.target.value)}
                onBlur={() => saveTime("cookTime")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveTime("cookTime"); }
                  if (e.key === "Escape") setEditingTime(null);
                }}
                placeholder="mins"
                className="w-16 bg-transparent border-b border-brand-orange focus:outline-none text-foreground text-sm text-center"
              />
              <span className="text-muted-foreground text-xs">min</span>
            </div>
          ) : (
            <button
              onClick={() => startEditingTime("cookTime")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group/cook"
              title="Click to edit cook time"
            >
              <ChefHat className="w-4 h-4" />
              <span>{cookTime != null ? `Cook ${formatTime(cookTime)}` : "Add cook time"}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover/cook:opacity-60 transition-opacity" />
            </button>
          )}

          {/* Total time — shown only if different from prep+cook */}
          {totalTime != null && (prepTime == null || cookTime == null || totalTime !== prepTime + cookTime) && (
            editingTime === "totalTime" ? (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">Total</span>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  value={timeInputValue}
                  onChange={(e) => setTimeInputValue(e.target.value)}
                  onBlur={() => saveTime("totalTime")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveTime("totalTime"); }
                    if (e.key === "Escape") setEditingTime(null);
                  }}
                  placeholder="mins"
                  className="w-16 bg-transparent border-b border-brand-orange focus:outline-none text-foreground text-sm text-center"
                />
                <span className="text-muted-foreground text-xs">min</span>
              </div>
            ) : (
              <button
                onClick={() => startEditingTime("totalTime")}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group/total"
                title="Click to edit total time"
              >
                <span>Total {formatTime(totalTime)}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover/total:opacity-60 transition-opacity" />
              </button>
            )
          )}

          <span className={cn("font-medium", difficultyColor(recipe.difficulty))}>
            {difficultyLabel(recipe.difficulty)}
          </span>
          {overlapPercent != null && (
            <span
              className={cn("font-medium text-sm", overlapColor(overlapPercent))}
              title={`${overlapPercent}% of ingredients already in this week's meal plan`}
            >
              {overlapPercent}% ingredient match
            </span>
          )}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {recipe.sourceName ?? "Source"}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Editable collection */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          {editingField === "collection" ? (
            <>
              <input
                autoFocus
                list="collection-datalist"
                value={collectionValue}
                onChange={(e) => setCollectionValue(e.target.value)}
                onBlur={() => saveField("collection", collectionValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveField("collection", collectionValue); }
                  if (e.key === "Escape") { setCollectionValue(recipe.collection ?? ""); setEditingField(null); }
                }}
                placeholder="Add to a cookbook…"
                className="text-sm text-foreground bg-transparent border-b border-brand-orange focus:outline-none flex-1"
              />
              <datalist id="collection-datalist">
                {cookbooks.map((c) => <option key={c} value={c} />)}
              </datalist>
            </>
          ) : (
            <button
              onClick={() => setEditingField("collection")}
              className="text-sm text-left flex items-center gap-1.5 group/coll"
              title="Click to edit cookbook"
            >
              <span className={collectionValue ? "text-foreground" : "text-muted-foreground/40 italic"}>
                {collectionValue || "Add to a cookbook…"}
              </span>
              <Pencil className="w-3 h-3 text-muted-foreground/30 group-hover/coll:text-muted-foreground transition-colors" />
            </button>
          )}
        </div>

        {/* Editable tags */}
        <div className="flex items-start gap-2">
          <Tag className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors",
                  editingTags
                    ? "bg-secondary text-foreground pr-1"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {tag}
                {editingTags && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground hover:text-red-400 transition-colors rounded-full"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}

            {editingTags ? (
              <input
                ref={tagInputRef}
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    commitTagInput();
                  }
                  if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                  if (e.key === "Escape") {
                    commitTagInput();
                    setEditingTags(false);
                  }
                }}
                onBlur={() => {
                  commitTagInput();
                  setEditingTags(false);
                }}
                placeholder="Add tag…"
                className="text-xs bg-transparent border-b border-brand-orange focus:outline-none text-foreground placeholder:text-muted-foreground/40 w-24"
              />
            ) : (
              <button
                onClick={() => { setEditingTags(true); setTimeout(() => tagInputRef.current?.focus(), 0); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors italic"
              >
                <Pencil className="w-3 h-3" />
                {tags.length === 0 ? "Add tags…" : "Edit"}
              </button>
            )}
          </div>
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "w-5 h-5 transition-colors",
                  star <= (hoverRating || rating)
                    ? "fill-brand-orange text-brand-orange"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-sm text-muted-foreground ml-1">{rating.toFixed(1)}</span>
          )}
        </div>
      </div>

      {/* ── Nutrition panel ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-foreground">Nutrition</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per serving{nutrition?.servingSize ? ` (${nutrition.servingSize})` : ""}
              {scaleFactor !== 1 && (
                <span className="text-brand-orange ml-1">· scaled to {servings} servings</span>
              )}
              {nutrition?.isEstimated && (
                <span className="ml-1">· AI estimate</span>
              )}
            </p>
          </div>
          <button
            onClick={estimateNutrition}
            disabled={estimatingNutrition}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-brand-orange hover:border-brand-orange/40 hover:bg-brand-orange/5 transition-colors disabled:opacity-50"
          >
            {estimatingNutrition ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {nutrition ? "Re-estimate" : "Estimate with AI"}
          </button>
        </div>

        {nutrition ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {[
              { label: "Calories", value: nutrition.calories, unit: "kcal", color: "text-orange-400" },
              { label: "Protein",  value: nutrition.protein,  unit: "g",    color: "text-blue-400" },
              { label: "Carbs",    value: nutrition.carbs,    unit: "g",    color: "text-yellow-400" },
              { label: "Fat",      value: nutrition.fat,      unit: "g",    color: "text-purple-400" },
              { label: "Fiber",    value: nutrition.fiber,    unit: "g",    color: "text-green-400" },
              { label: "Sugar",    value: nutrition.sugar,    unit: "g",    color: "text-pink-400" },
              { label: "Iron",     value: nutrition.iron,     unit: "mg",   color: "text-red-400" },
            ].map(({ label, value, unit, color }) => {
              if (value == null) return null;
              const scaled = Math.round(value * scaleFactor * 10) / 10;
              return (
                <div key={label} className="flex flex-col items-center text-center bg-secondary/50 rounded-lg px-2 py-3 gap-1">
                  <span className={`text-lg font-bold leading-none ${color}`}>
                    {scaled % 1 === 0 ? scaled : scaled.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{unit}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground/50">
            Click &ldquo;Estimate with AI&rdquo; to calculate nutrition facts from the ingredients
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Ingredients — left (40%) */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Ingredients</h2>
              <div className="flex items-center gap-2">
                {/* Edit toggle */}
                <button
                  onClick={() => setEditingIngredients((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors",
                    editingIngredients
                      ? "bg-brand-orange/15 border-brand-orange/40 text-brand-orange"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Pencil className="w-3 h-3" />
                  {editingIngredients ? "Done" : "Edit"}
                </button>
                {/* Servings scaler — hidden while editing to avoid confusion */}
                {!editingIngredients && (
                  <>
                    <button
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      className="w-7 h-7 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-medium w-16 text-center">
                      {servings} {servings === 1 ? "serving" : "servings"}
                    </span>
                    <button
                      onClick={() => setServings(servings + 1)}
                      className="w-7 h-7 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {!editingIngredients && scaleFactor !== 1 && (
              <p className="text-xs text-brand-orange mb-3">
                Scaled from {recipe.servings} servings
              </p>
            )}

            {editingIngredients ? (
              <div className="space-y-1.5">
                {ingredients.map((ing) => (
                  <IngredientEditRow
                    key={ing.id}
                    ingredient={ing}
                    autoFocus={ing.id === newIngredientId}
                    onSave={(patch) => saveIngredient(ing.id, patch)}
                    onDelete={() => deleteIngredient(ing.id)}
                  />
                ))}
                <button
                  onClick={addIngredient}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border hover:border-brand-orange/50 hover:bg-brand-orange/5 text-xs text-muted-foreground hover:text-brand-orange transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add ingredient
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {ingredients.map((ing) => (
                  <li key={ing.id} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 shrink-0" />
                    <span className={cn(ing.quantity == null ? "text-muted-foreground italic" : "text-foreground")}>
                      {renderIngredientQuantity(ing)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* Instructions — right (60%) */}
        <div className="md:col-span-3">
          <h2 className="font-semibold text-foreground mb-4">Instructions</h2>
          <ol className="space-y-5">
            {recipe.instructions.map((step) => (
              <li key={step.id} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-orange/15 text-brand-orange text-sm font-semibold flex items-center justify-center">
                  {step.stepNumber}
                </span>
                <p className="text-foreground leading-relaxed pt-1">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {/* Notes */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-brand-orange" />
            My Notes
          </h2>
          {!editingNotes && (
            <button
              onClick={() => setEditingNotes(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {notesValue ? "Edit" : "Add note"}
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") saveNotes();
              }}
              rows={5}
              placeholder="Add your personal notes here — substitutions you tried, tips, how the kids liked it…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange resize-none"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setNotesValue(recipe.notes ?? ""); setEditingNotes(false); }}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-3 py-1.5 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        ) : notesValue ? (
          <button
            onClick={() => setEditingNotes(true)}
            className="w-full text-left text-sm text-foreground leading-relaxed whitespace-pre-wrap hover:bg-secondary/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
          >
            {notesValue}
          </button>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="w-full text-left text-sm text-muted-foreground/40 italic hover:text-muted-foreground transition-colors"
          >
            No notes yet — click to add…
          </button>
        )}
      </div>
      {/* Lightbox */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center cursor-zoom-out"
          onClick={closeLightbox}
        >
          {/* Close button — large tap target, always visible */}
          <button
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            className="absolute top-14 right-4 md:top-5 md:right-5 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-white transition-colors shadow-lg"
            aria-label="Close photo"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image — stop click propagation so tapping the photo doesn't close */}
          <div
            className="relative w-full h-full p-4 md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={imageUrl}
              alt={titleValue}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ingredient edit row ──────────────────────────────────────────────────────

function IngredientEditRow({
  ingredient,
  onSave,
  onDelete,
  autoFocus = false,
}: {
  ingredient: Ingredient;
  onSave: (patch: { name?: string; quantity?: number | null; unit?: string | null }) => void;
  onDelete: () => void;
  autoFocus?: boolean;
}) {
  const [qty, setQty] = useState(ingredient.quantity != null ? String(ingredient.quantity) : "");
  const [unit, setUnit] = useState(ingredient.unit ?? "");
  const [name, setName] = useState(ingredient.name);

  function commitQty() {
    const parsed = qty.trim() === "" ? null : parseFloat(qty);
    const value = parsed != null && !isNaN(parsed) ? parsed : null;
    if (value !== ingredient.quantity) onSave({ quantity: value });
  }

  function commitUnit() {
    const value = unit.trim() || null;
    if (value !== ingredient.unit) onSave({ unit: value });
  }

  function commitName() {
    const value = name.trim();
    // If new blank ingredient left empty, delete it
    if (!value && !ingredient.name) { onDelete(); return; }
    if (!value) { setName(ingredient.name); return; }
    if (value !== ingredient.name) onSave({ name: value });
  }

  return (
    <div className="flex items-center gap-1.5 group/row">
      {/* Quantity */}
      <input
        type="text"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="qty"
        className="w-12 shrink-0 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-orange text-center"
      />
      {/* Unit */}
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={commitUnit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="unit"
        className="w-16 shrink-0 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-orange"
      />
      {/* Name */}
      <input
        type="text"
        value={name}
        autoFocus={autoFocus}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="ingredient name"
        className="flex-1 min-w-0 bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-orange"
      />
      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
        aria-label="Remove ingredient"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
