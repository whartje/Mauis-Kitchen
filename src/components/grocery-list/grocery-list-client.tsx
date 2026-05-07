"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { pantryMatchesGrocery } from "@/lib/pantry-match";
import {
  Check,
  Plus,
  Trash2,
  RefreshCw,
  ShoppingCart,
  Loader2,
  X,
  Copy,
  CheckCircle2,
  Share2,
  Mail,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type IngredientCategory =
  | "PRODUCE"
  | "FRUIT"
  | "PROTEIN"
  | "DAIRY"
  | "GRAINS"
  | "PANTRY"
  | "SPICES"
  | "FROZEN"
  | "BEVERAGES"
  | "CONDIMENTS"
  | "OTHER";

interface GroceryListItem {
  id: string;
  groceryListId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  raw: string;
  category: IngredientCategory;
  isChecked: boolean;
  sortOrder: number;
  recipeIds: string[];
  recipeTitles: string[];
}

interface GroceryListWithItems {
  id: string;
  userId: string;
  mealPlanId: string | null;
  name: string;
  createdAt: Date | string;
  sentToAlexa: boolean;
  alexaSentAt: Date | string | null;
  items: GroceryListItem[];
}

interface Props {
  initialList: GroceryListWithItems | null;
  currentWeekStart: string;
  currentWeekLabel: string;
  hasMealPlan: boolean;
  pantryNames?: string[];
  alexaConnected?: boolean; // kept for backwards compat, no longer used
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: IngredientCategory[] = [
  "PRODUCE",
  "FRUIT",
  "PROTEIN",
  "DAIRY",
  "GRAINS",
  "PANTRY",
  "SPICES",
  "FROZEN",
  "BEVERAGES",
  "CONDIMENTS",
  "OTHER",
];

const CATEGORY_META: Record<IngredientCategory, { emoji: string; label: string }> = {
  PRODUCE:    { emoji: "🥦",  label: "Produce" },
  FRUIT:      { emoji: "🍎",  label: "Fruit" },
  PROTEIN:    { emoji: "🥩",  label: "Protein" },
  DAIRY:      { emoji: "🥛",  label: "Dairy" },
  GRAINS:     { emoji: "🌾",  label: "Grains & Bread" },
  PANTRY:     { emoji: "🥫",  label: "Pantry & Canned" },
  SPICES:     { emoji: "🧂",  label: "Spices & Seasonings" },
  FROZEN:     { emoji: "❄️",  label: "Frozen" },
  BEVERAGES:  { emoji: "🧃",  label: "Beverages" },
  CONDIMENTS: { emoji: "🫙",  label: "Condiments" },
  OTHER:      { emoji: "🥨",  label: "Other" },
};

const CATEGORY_OPTIONS: IngredientCategory[] = [
  "PRODUCE",
  "FRUIT",
  "PROTEIN",
  "DAIRY",
  "GRAINS",
  "PANTRY",
  "SPICES",
  "FROZEN",
  "BEVERAGES",
  "CONDIMENTS",
  "OTHER",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatQuantity(item: GroceryListItem): string {
  const parts: string[] = [];
  if (item.quantity !== null && item.quantity !== undefined) {
    parts.push(String(item.quantity));
  }
  if (item.unit) {
    parts.push(item.unit);
  }
  return parts.join(" ");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GroceryListClient({
  initialList,
  currentWeekStart,
  currentWeekLabel,
  hasMealPlan,
  pantryNames = [],
}: Props) {
  const router = useRouter();
  const [list, setList] = useState<GroceryListWithItems | null>(initialList);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [clearingChecked, setClearingChecked] = useState(false);

  // Add item form state
  const [addText, setAddText] = useState("");
  const [addCategory, setAddCategory] = useState<IngredientCategory>("OTHER");
  const [addingItem, setAddingItem] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Share panel state
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const sharePanelRef = useRef<HTMLDivElement>(null);

  // Per-item delete
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Close share panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sharePanelRef.current && !sharePanelRef.current.contains(e.target as Node)) {
        setShowSharePanel(false);
      }
    }
    if (showSharePanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSharePanel]);

  // ── Week guard: auto-refresh when the calendar week rolls over ───────────
  useEffect(() => {
    function getClientMonday(): string {
      const now = new Date();
      const day = now.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() + diff);
      monday.setUTCHours(0, 0, 0, 0);
      return monday.toISOString().split("T")[0];
    }
    const serverWeek = currentWeekStart.split("T")[0];
    function check() {
      if (getClientMonday() !== serverWeek) router.refresh();
    }
    check(); // check immediately on mount (catches stale cached render)
    const id = setInterval(check, 60_000); // re-check every minute
    return () => clearInterval(id);
  }, [currentWeekStart, router]);

  // ── Generate / Regenerate ────────────────────────────────────────────────

  const generateList = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: currentWeekStart }),
      });
      if (!res.ok) {
        const data = await res.json();
        setGenerateError(data.error ?? "Failed to generate list");
        return;
      }
      const data = await res.json();
      setList(data.list);
    } catch {
      setGenerateError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [currentWeekStart]);

  // ── Toggle isChecked ─────────────────────────────────────────────────────

  const toggleItem = useCallback(
    async (itemId: string, currentChecked: boolean) => {
      if (!list) return;

      // Optimistic update
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId ? { ...it, isChecked: !currentChecked } : it
          ),
        };
      });

      try {
        const res = await fetch(
          `/api/grocery-list/${list.id}/items/${itemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isChecked: !currentChecked }),
          }
        );
        if (!res.ok) {
          // Revert
          setList((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items.map((it) =>
                it.id === itemId ? { ...it, isChecked: currentChecked } : it
              ),
            };
          });
        }
      } catch {
        // Revert
        setList((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((it) =>
              it.id === itemId ? { ...it, isChecked: currentChecked } : it
            ),
          };
        });
      }
    },
    [list]
  );

  // ── Clear checked items ──────────────────────────────────────────────────

  const clearChecked = useCallback(async () => {
    if (!list) return;
    const checkedItems = list.items.filter((it) => it.isChecked);
    if (checkedItems.length === 0) return;

    setClearingChecked(true);

    // Optimistic update — remove checked items immediately
    const prevItems = list.items;
    setList((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((it) => !it.isChecked),
      };
    });

    try {
      await Promise.all(
        checkedItems.map((item) =>
          fetch(`/api/grocery-list/${list.id}/items/${item.id}`, {
            method: "DELETE",
          })
        )
      );
    } catch {
      // Revert on error
      setList((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prevItems };
      });
    } finally {
      setClearingChecked(false);
    }
  }, [list]);

  // ── Update individual item ───────────────────────────────────────────────

  const updateItem = useCallback(
    async (itemId: string, patch: { name?: string; quantity?: number | null; unit?: string | null }) => {
      if (!list) return;
      setList((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.map((it) => it.id === itemId ? { ...it, ...patch } : it) };
      });
      await fetch(`/api/grocery-list/${list.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
    [list]
  );

  // ── Delete individual item ───────────────────────────────────────────────

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!list) return;
      setDeletingItemId(itemId);

      // Optimistic removal
      const prevItems = list.items;
      setList((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.filter((it) => it.id !== itemId) };
      });

      try {
        const res = await fetch(`/api/grocery-list/${list.id}/items/${itemId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          // Revert
          setList((prev) => {
            if (!prev) return prev;
            return { ...prev, items: prevItems };
          });
        }
      } catch {
        setList((prev) => {
          if (!prev) return prev;
          return { ...prev, items: prevItems };
        });
      } finally {
        setDeletingItemId(null);
      }
    },
    [list]
  );

  // ── Add custom item ──────────────────────────────────────────────────────

  // Parse "2 cups flour" → { quantity, unit, name }
  // Mirrors the same logic used in the pantry.
  const UNIT_RE = "ml|l|g|kg|oz|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?|pints?|quarts?|gallons?|cloves?|bunches?|sprigs?|heads?|stalks?|slices?|pieces?|cans?|jars?|bags?|boxes?|packages?|handfuls?";

  function parseAddText(text: string): { quantity: number | null; unit: string | null; name: string } {
    const m = text.trim().match(
      new RegExp(`^([\\d./½¼¾⅓⅔⅛⅜⅝⅞]+(?:\\s+[\\d./½¼¾⅓⅔⅛⅜⅝⅞]+)?)\\s*(${UNIT_RE})?\\s+(.+)$`, "i")
    );
    if (m) {
      // Handle mixed fractions like "1 ½" → 1.5
      const qtyStr = m[1].trim();
      const parts = qtyStr.split(/\s+/);
      let qty = 0;
      for (const p of parts) {
        const FRAC: Record<string, number> = { "½":0.5,"¼":0.25,"¾":0.75,"⅓":1/3,"⅔":2/3,"⅛":0.125,"⅜":0.375,"⅝":0.625,"⅞":0.875 };
        if (FRAC[p]) qty += FRAC[p];
        else if (p.includes("/")) { const [n,d] = p.split("/"); qty += Number(n)/Number(d); }
        else qty += parseFloat(p) || 0;
      }
      return {
        quantity: qty || null,
        unit: m[2] ? m[2].toLowerCase() : null,
        name: m[3].trim(),
      };
    }
    return { quantity: null, unit: null, name: text.trim() };
  }

  // Live preview of what will be parsed (shown under the input)
  const addPreview = useMemo(() => {
    const t = addText.trim();
    if (!t) return null;
    const { quantity, unit, name } = parseAddText(t);
    if (!name) return null;
    const parts = [quantity != null ? quantity : null, unit, name].filter(Boolean);
    return parts.join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addText]);

  const addItem = useCallback(async () => {
    if (!list || !addText.trim()) return;
    setAddingItem(true);
    setAddError(null);

    const { quantity, unit, name } = parseAddText(addText);
    if (!name) { setAddError("Enter an item name"); setAddingItem(false); return; }

    try {
      const res = await fetch(`/api/grocery-list/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity: quantity ?? undefined, unit: unit ?? undefined, category: addCategory }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error ?? "Failed to add item");
        return;
      }

      const data = await res.json();
      const newItem: GroceryListItem = data.item;

      setList((prev) => {
        if (!prev) return prev;
        return { ...prev, items: [...prev.items, newItem] };
      });

      setAddText("");
      setAddCategory("OTHER");
      addInputRef.current?.focus();
    } catch {
      setAddError("Something went wrong. Please try again.");
    } finally {
      setAddingItem(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, addText, addCategory]);

  // ── Share / Copy list ────────────────────────────────────────────────────

  const buildListText = useCallback(() => {
    if (!list) return "";
    const lines: string[] = [`🛒 ${list.name || "Grocery List"}`, ""];
    for (const cat of CATEGORY_ORDER) {
      const items = (list.items ?? []).filter((it) => it.category === cat && !it.isChecked);
      if (items.length === 0) continue;
      const meta = CATEGORY_META[cat];
      lines.push(`${meta.emoji} ${meta.label}`);
      for (const item of items) {
        const qty = formatQuantity(item);
        lines.push(`  • ${item.name}${qty ? ` (${qty})` : ""}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }, [list]);

  const handleShareClick = useCallback(async () => {
    // On mobile, use native share sheet (includes Alexa app, Messages, etc.)
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: "Grocery List", text: buildListText() });
        return;
      } catch {
        // cancelled — fall through
      }
    }
    // On desktop, show our custom panel
    setShowSharePanel((p) => !p);
  }, [buildListText]);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(buildListText());
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2500);
  }, [buildListText]);

  const emailList = useCallback(() => {
    const text = buildListText();
    const subject = encodeURIComponent(list?.name || "Grocery List");
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [buildListText, list]);

  // ── Derived state ────────────────────────────────────────────────────────

  const totalItems = list?.items.length ?? 0;
  const checkedCount = list?.items.filter((it) => it.isChecked).length ?? 0;
  const hasChecked = checkedCount > 0;
  const progressPercent = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  // Group items by category
  const groupedItems = CATEGORY_ORDER.reduce<
    Record<IngredientCategory, GroceryListItem[]>
  >(
    (acc, cat) => {
      acc[cat] = (list?.items ?? [])
        .filter((it) => it.category === cat)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return acc;
    },
    {} as Record<IngredientCategory, GroceryListItem[]>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#E8834A]" />
            Grocery List
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{currentWeekLabel}</p>

          {/* Share + Generate/Regenerate — row below the date */}
          <div className="flex items-center gap-2 mt-3">
            {/* Share List — only shown when a list exists with unchecked items */}
            {list && list.items.some((it) => !it.isChecked) && (
              <div className="relative" ref={sharePanelRef}>
                <button
                  onClick={handleShareClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-[#E8834A]/50 hover:bg-[#E8834A]/5 text-sm font-medium transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share List
                </button>

            {/* Desktop share panel */}
            {showSharePanel && (
              <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border rounded-xl shadow-xl w-72 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share options</p>

                {/* Copy to clipboard */}
                <button
                  onClick={copyToClipboard}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm text-left"
                >
                  {copyStatus === "copied" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={copyStatus === "copied" ? "text-green-400" : "text-foreground"}>
                    {copyStatus === "copied" ? "Copied!" : "Copy to clipboard"}
                  </span>
                </button>

                {/* Email */}
                <button
                  onClick={emailList}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm text-left"
                >
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">Email list</span>
                </button>

                {/* Alexa web */}
                <div className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base leading-none flex-shrink-0">🔵</span>
                    <div>
                      <p className="text-foreground text-sm font-medium">Add to Alexa Shopping List</p>
                      <p className="text-xs text-muted-foreground">Copy list, then paste into Alexa web</p>
                    </div>
                    <button
                      onClick={copyToClipboard}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    >
                      {copyStatus === "copied" ? (
                        <><CheckCircle2 className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                      ) : (
                        <><Copy className="w-3 h-3" />Copy list</>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <p className="text-xs text-muted-foreground">Then go to:</p>
                    <code
                      className="text-xs text-brand-orange select-all cursor-text bg-background px-2 py-0.5 rounded border border-border"
                      title="Select all and copy this URL, then paste into your browser"
                    >
                      alexa.amazon.com
                    </code>
                  </div>
                </div>
              </div>
            )}
              </div>
            )}

            {/* Generate / Regenerate button */}
            <div className="relative group">
              <button
                onClick={!hasMealPlan ? undefined : generateList}
                disabled={generating || !hasMealPlan}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  hasMealPlan
                    ? "bg-[#E8834A] hover:bg-[#d4733c] text-white cursor-pointer disabled:opacity-60"
                    : "bg-[#E8834A]/40 text-white/60 cursor-not-allowed",
                ].join(" ")}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : list ? (
                  <RefreshCw className="w-4 h-4" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
                {list ? "Regenerate" : "Generate from Meal Plan"}
              </button>

              {!hasMealPlan && (
                <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block">
                  <div className="bg-card border border-border text-muted-foreground text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    Add recipes to your meal plan first
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {generateError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            <X className="w-4 h-4 flex-shrink-0" />
            {generateError}
          </div>
        )}

        {/* ── Progress Bar ── */}
        {list && totalItems > 0 && (
          <div className="mt-4 mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-1.5">
              <span>
                {checkedCount} of {totalItems} items
              </span>
              {hasChecked && (
                <button
                  onClick={clearChecked}
                  disabled={clearingChecked}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {clearingChecked ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Clear checked
                </button>
              )}
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E8834A] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Empty States ── */}
        {!list && !hasMealPlan && (
          <div className="mt-8 bg-card border border-border rounded-xl p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              No grocery list yet
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Plan your meals first, then generate your grocery list automatically.
            </p>
            <Link
              href="/meal-plan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E8834A] hover:bg-[#d4733c] text-white text-sm font-medium transition-colors"
            >
              Go to Meal Plan
            </Link>
          </div>
        )}

        {!list && hasMealPlan && (
          <div className="mt-8 bg-card border border-border rounded-xl p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-[#E8834A] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Ready to generate
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Generate your grocery list from this week&apos;s meal plan.
            </p>
            <button
              onClick={generateList}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E8834A] hover:bg-[#d4733c] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              Generate Grocery List
            </button>
          </div>
        )}

        {/* ── Items grouped by category ── */}
        {list && (
          <div className="space-y-6 mt-2">
            {CATEGORY_ORDER.map((cat) => {
              const items = groupedItems[cat];
              if (items.length === 0) return null;
              const meta = CATEGORY_META[cat];

              return (
                <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Category header */}
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <span className="text-base leading-none">{meta.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {meta.label}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {items.filter((it) => it.isChecked).length}/{items.length}
                    </span>
                  </div>

                  {/* Items */}
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        pantryNames={pantryNames}
                        deleting={deletingItemId === item.id}
                        onToggle={() => toggleItem(item.id, item.isChecked)}
                        onUpdate={(patch) => updateItem(item.id, patch)}
                        onDelete={() => deleteItem(item.id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* ── Add custom item form ── */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#E8834A]" />
                Add item
              </p>

              {addError && (
                <div className="mb-3 flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  <X className="w-3.5 h-3.5 flex-shrink-0" />
                  {addError}
                </div>
              )}

              {/* Single-line natural text + category + Add */}
              {/* flex-wrap: input takes full first row, select+button share second row on mobile */}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={addInputRef}
                  type="text"
                  placeholder="e.g. 2 cups flour, 3 avocados, olive oil…"
                  value={addText}
                  onChange={(e) => { setAddText(e.target.value); setAddError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && addText.trim()) addItem(); }}
                  className="w-full min-w-0 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#E8834A] focus:border-[#E8834A]"
                />
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as IngredientCategory)}
                  className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#E8834A] focus:border-[#E8834A]"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addItem}
                  disabled={addingItem || !addText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E8834A] hover:bg-[#d4733c] text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                >
                  {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>

              {/* Live parse preview */}
              <p className="text-xs text-muted-foreground mt-2 min-h-[1.25rem]">
                {addPreview
                  ? <><span className="text-[#E8834A]">→</span> {addPreview}</>
                  : "Include quantity and unit — e.g. “6 tbsp olive oil” or just “garlic”"
                }
              </p>
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Editable item row ────────────────────────────────────────────────────────

function GroceryItemRow({
  item,
  pantryNames,
  deleting,
  onToggle,
  onUpdate,
  onDelete,
}: {
  item: GroceryListItem;
  pantryNames: string[];
  deleting: boolean;
  onToggle: () => void;
  onUpdate: (patch: { name?: string; quantity?: number | null; unit?: string | null }) => void;
  onDelete: () => void;
}) {
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [name, setName] = useState(item.name);

  const inPantry = pantryNames.length > 0 && pantryMatchesGrocery(item.name, pantryNames);

  function commitQty() {
    const parsed = qty.trim() === "" ? null : parseFloat(qty);
    const value = parsed != null && !isNaN(parsed) ? parsed : null;
    if (value !== item.quantity) onUpdate({ quantity: value });
  }

  function commitUnit() {
    const value = unit.trim() || null;
    if (value !== item.unit) onUpdate({ unit: value });
  }

  function commitName() {
    const value = name.trim();
    if (!value) { setName(item.name); return; }
    if (value !== item.name) onUpdate({ name: value });
  }

  const sources = item.recipeIds ?? [];

  return (
    <li
      className={[
        "group/row flex items-center gap-2 px-4 py-2.5 transition-colors",
        inPantry
          ? "bg-green-500/10 border-l-2 border-green-500/60"
          : "border-l-2 border-transparent",
      ].join(" ")}
      title={inPantry ? "You already have this in your pantry" : undefined}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={[
          "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
          item.isChecked
            ? "bg-[#E8834A] border-[#E8834A]"
            : "border-border hover:border-[#E8834A]",
        ].join(" ")}
        aria-label={item.isChecked ? `Uncheck ${item.name}` : `Check ${item.name}`}
      >
        {item.isChecked && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Qty */}
      <input
        type="text"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="qty"
        className={[
          "w-10 shrink-0 bg-transparent border-b border-transparent hover:border-border focus:border-[#E8834A]",
          "px-0.5 py-0.5 text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none text-center transition-colors",
          item.isChecked ? "opacity-50" : "",
        ].join(" ")}
      />

      {/* Unit */}
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={commitUnit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="unit"
        className={[
          "w-14 shrink-0 bg-transparent border-b border-transparent hover:border-border focus:border-[#E8834A]",
          "px-0.5 py-0.5 text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none transition-colors",
          item.isChecked ? "opacity-50" : "",
        ].join(" ")}
      />

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={[
          "flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-border focus:border-[#E8834A]",
          "px-0.5 py-0.5 text-sm focus:outline-none transition-colors",
          item.isChecked ? "line-through text-muted-foreground" : "text-foreground",
        ].join(" ")}
      />

      {/* Pantry badge — desktop: shown here (before recipe sources) */}
      {inPantry && (
        <span
          className="hidden sm:inline-flex shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 leading-tight"
          title="You already have this in your pantry"
        >
          in pantry
        </span>
      )}

      {/* Recipe sources — hidden on mobile portrait, visible sm+ (landscape/tablet) */}
      {sources.length > 0 && (
        <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 max-w-[130px]">
          {sources.map((id, i) => (
            <Link
              key={id}
              href={`/recipes/${id}`}
              className="text-[10px] leading-tight text-muted-foreground/50 hover:text-[#E8834A] transition-colors truncate w-full text-right"
              title={item.recipeTitles[i]}
            >
              {item.recipeTitles[i]}
            </Link>
          ))}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="flex-shrink-0 text-muted-foreground/0 group-hover/row:text-muted-foreground/40 hover:!text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors disabled:opacity-30"
        aria-label={`Remove ${item.name}`}
      >
        {deleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </button>

    </li>
  );
}
