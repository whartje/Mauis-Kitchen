"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Clock, ChefHat, Star, Heart, ExternalLink, Minus, Plus, Camera, Loader2, Pencil, BookOpen, Trash2, Tag, X, NotebookPen } from "lucide-react";
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
}

export function RecipeDetailClient({ recipe }: Props) {
  const [servings, setServings] = useState(recipe.servings);
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorite);
  const [rating, setRating] = useState(recipe.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [imageUrl, setImageUrl] = useState(recipe.imageUrl);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
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

  function renderIngredientQuantity(ing: Ingredient): string {
    if (ing.quantity == null) return ing.raw;
    const scaled = scaleQuantity(ing.quantity, ing.unit, recipe.servings, servings);
    return `${scaled.display} ${ing.name}${ing.notes ? `, ${ing.notes}` : ""}`;
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

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {recipe.prepTime && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Prep {formatTime(recipe.prepTime)}</span>
            </div>
          )}
          {recipe.cookTime && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ChefHat className="w-4 h-4" />
              <span>Cook {formatTime(recipe.cookTime)}</span>
            </div>
          )}
          <span className={cn("font-medium", difficultyColor(recipe.difficulty))}>
            {difficultyLabel(recipe.difficulty)}
          </span>
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

      {/* Two-column layout */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Ingredients — left (40%) */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Ingredients</h2>
              {/* Servings scaler */}
              <div className="flex items-center gap-2">
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
              </div>
            </div>

            {scaleFactor !== 1 && (
              <p className="text-xs text-brand-orange mb-3">
                Scaled from {recipe.servings} servings
              </p>
            )}

            <ul className="space-y-2">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-2 shrink-0" />
                  <span className={cn(ing.quantity == null ? "text-muted-foreground italic" : "text-foreground")}>
                    {renderIngredientQuantity(ing)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Nutrition */}
          {recipe.nutrition && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3">Nutrition</h2>
              <p className="text-xs text-muted-foreground mb-3">Per serving{recipe.nutrition.servingSize ? ` (${recipe.nutrition.servingSize})` : ""}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Calories", recipe.nutrition.calories, "kcal"],
                  ["Protein", recipe.nutrition.protein, "g"],
                  ["Carbs", recipe.nutrition.carbs, "g"],
                  ["Fat", recipe.nutrition.fat, "g"],
                  ["Fiber", recipe.nutrition.fiber, "g"],
                  ["Sugar", recipe.nutrition.sugar, "g"],
                ].map(([label, val, unit]) =>
                  val != null ? (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{val}{unit}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
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
    </div>
  );
}
