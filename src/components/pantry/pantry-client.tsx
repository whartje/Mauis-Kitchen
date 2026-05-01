"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus, Package, Camera, Loader2, ScanLine, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type IngredientCategory = "PRODUCE" | "FRUIT" | "PROTEIN" | "DAIRY" | "GRAINS" | "PANTRY" | "SPICES" | "FROZEN" | "BEVERAGES" | "CONDIMENTS" | "OTHER";

const CATEGORY_ORDER: IngredientCategory[] = [
  "PRODUCE", "FRUIT", "PROTEIN", "DAIRY", "GRAINS", "PANTRY", "SPICES", "FROZEN", "BEVERAGES", "CONDIMENTS", "OTHER",
];

const CATEGORY_META: Record<IngredientCategory, { label: string; icon: string }> = {
  PRODUCE:    { label: "Produce",          icon: "🥬" },
  FRUIT:      { label: "Fruit",            icon: "🍎" },
  PROTEIN:    { label: "Protein",          icon: "🥩" },
  DAIRY:      { label: "Dairy",            icon: "🧀" },
  GRAINS:     { label: "Grains & Bread",   icon: "🌾" },
  PANTRY:     { label: "Pantry & Canned",  icon: "🥫" },
  SPICES:     { label: "Spices & Herbs",   icon: "🌿" },
  FROZEN:     { label: "Frozen",           icon: "❄️" },
  BEVERAGES:  { label: "Beverages",        icon: "🧃" },
  CONDIMENTS: { label: "Condiments",       icon: "🫙" },
  OTHER:      { label: "Other",            icon: "🥨" },
};

/** Naive keyword-based category inference for scanned items */
function inferCategory(name: string): IngredientCategory {
  const n = name.toLowerCase();
  if (/\b(apple|banana|orange|lemon|lime|berry|mango|grape|cherry|peach|pear|plum|melon|kiwi|pineapple|strawberr|blueberr|raspberr|avocado|tomato|fig|date|coconut)\b/.test(n)) return "FRUIT";
  if (/\b(lettuce|spinach|kale|broccoli|carrot|celery|onion|garlic|pepper|cucumber|zucchini|mushroom|potato|sweet potato|corn|cabbage|cauliflower|asparagus|green bean|pea|squash|arugula|beet|leek|scallion|shallot|chard|endive|fennel|radish|turnip|parsnip|artichoke|bok choy)\b/.test(n)) return "PRODUCE";
  if (/\b(chicken|beef|pork|fish|salmon|tuna|shrimp|prawn|turkey|lamb|bacon|sausage|egg|tofu|tempeh|lentil|chickpea|ham|steak|mince|ground beef|deli|anchov)\b/.test(n)) return "PROTEIN";
  if (/\b(milk|cheese|butter|cream|yogurt|sour cream|cottage cheese|cream cheese|mozzarella|parmesan|cheddar|brie|gouda|ricotta|whey|kefir|ghee)\b/.test(n)) return "DAIRY";
  if (/\b(flour|rice|pasta|bread|oat|quinoa|barley|cereal|cracker|tortilla|noodle|couscous|breadcrumb|wheat|rye|semolina|polenta|bulgur|farro|spelt)\b/.test(n)) return "GRAINS";
  if (/\b(salt|pepper|cumin|paprika|turmeric|oregano|basil|thyme|rosemary|cinnamon|nutmeg|cayenne|chili|ginger|garlic powder|onion powder|bay leaf|herb|spice|seasoning|cardamom|coriander|curry|clove|anise|dill|tarragon|saffron|vanilla|extract)\b/.test(n)) return "SPICES";
  if (/\b(frozen|ice cream|sorbet|popsicle)\b/.test(n)) return "FROZEN";
  if (/\b(juice|soda|water|coffee|tea|drink|beverage|wine|beer|spirit|liquor|broth|stock|smoothie|kombucha|energy drink|sparkling)\b/.test(n)) return "BEVERAGES";
  if (/\b(ketchup|catsup|mustard|mayo|mayonnaise|hot sauce|barbecue sauce|bbq sauce|salad dressing|ranch|caesar|vinaigrette|worcestershire|sriracha|tabasco|hoisin|teriyaki|fish sauce|oyster sauce|soy sauce|relish|chutney|salsa|guacamole|aioli|pesto|tzatziki|remoulade|chimichurri|miso|sambal|gochujang)\b/.test(n)) return "CONDIMENTS";
  if (/\b(oil|vinegar|sauce|honey|syrup|jam|jelly|peanut butter|almond butter|tahini|tomato paste|can|canned|jar|jarred|pickle|hummus|spread|dressing|marinade|paste|nut|seed|dried|chocolate|cocoa|sugar|baking|powder|soda|yeast|gelatin)\b/.test(n)) return "PANTRY";
  return "OTHER";
}

interface PantryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  raw: string;
  category: IngredientCategory;
}

interface ScannedIngredient {
  name: string;
  confidence: number;
  selected: boolean;
}

interface Props {
  initialItems: PantryItem[];
}

export function PantryClient({ initialItems }: Props) {
  const [items, setItems] = useState<PantryItem[]>(initialItems);
  const [newText, setNewText] = useState("");
  const [addCategory, setAddCategory] = useState<IngredientCategory>("OTHER");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Scan state ────────────────────────────────────────────────────────────
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "review">("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedIngredient[]>([]);
  const [addingScanned, setAddingScanned] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // Focus the add input when the page loads if empty
  useEffect(() => {
    if (items.length === 0) inputRef.current?.focus();
  }, []);

  // ── Parse "2 cups flour" → { quantity, unit, name } ──────────────────────
  function parseEntry(text: string): { name: string; quantity: number | null; unit: string | null } {
    const UNITS = "ml|l|g|kg|oz|lb|cups?|tbsp|tablespoons?|tsp|teaspoons?|pints?|quarts?|gallons?|cloves?|bunches?|sprigs?|heads?|stalks?|slices?|pieces?|cans?|jars?|bags?|boxes?|packages?|handfuls?";
    const m = text.trim().match(new RegExp(`^([\\d./½¼¾⅓⅔⅛⅜⅝⅞]+)\\s*(${UNITS})?\\s+(.+)$`, "i"));
    if (m) {
      const qty = parseFloat(m[1]);
      return {
        quantity: isNaN(qty) ? null : qty,
        unit: m[2] ? m[2].toLowerCase() : null,
        name: m[3].trim(),
      };
    }
    return { quantity: null, unit: null, name: text.trim() };
  }

  // ── Manual add ────────────────────────────────────────────────────────────
  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    const { name, quantity, unit } = parseEntry(text);
    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity, unit, category: addCategory }),
      });
      if (res.ok) {
        const item: PantryItem = await res.json();
        setItems((prev) => [...prev, item]);
        setNewText("");
        inputRef.current?.focus();
      }
    } finally {
      setAdding(false);
    }
  }

  // ── Photo scan ────────────────────────────────────────────────────────────
  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setScanError(null);
    setScanPhase("scanning");

    // Show preview immediately
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pantry/scan", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setScanError(data.error ?? "Scan failed. Please try again.");
        setScanPhase("idle");
        return;
      }

      const ingredients: Array<{ name: string; confidence: number }> = data.ingredients ?? [];
      if (ingredients.length === 0) {
        setScanError("No food items detected. Try a clearer photo with better lighting.");
        setScanPhase("idle");
        return;
      }

      // Pre-select items with confidence ≥ 0.75
      setScanned(ingredients.map((i) => ({ ...i, selected: i.confidence >= 0.75 })));
      setScanPhase("review");
    } catch {
      setScanError("Something went wrong. Please try again.");
      setScanPhase("idle");
    }
  }

  function toggleScannedItem(name: string) {
    setScanned((prev) => prev.map((i) => i.name === name ? { ...i, selected: !i.selected } : i));
  }

  function toggleAllScanned(select: boolean) {
    setScanned((prev) => prev.map((i) => ({ ...i, selected: select })));
  }

  const addSelectedToBackground = useCallback(async () => {
    const toAdd = scanned.filter((i) => i.selected);
    if (toAdd.length === 0) return;
    setAddingScanned(true);
    try {
      const results = await Promise.all(
        toAdd.map((i) =>
          fetch("/api/pantry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: i.name, quantity: null, unit: null, category: inferCategory(i.name) }),
          }).then((r) => r.ok ? r.json() as Promise<PantryItem> : null)
        )
      );
      const newItems = results.filter((r): r is PantryItem => r !== null);
      setItems((prev) => [...prev, ...newItems]);
      // Reset scan state
      setScanPhase("idle");
      setScanned([]);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    } finally {
      setAddingScanned(false);
    }
  }, [scanned, previewUrl]);

  function cancelScan() {
    setScanPhase("idle");
    setScanned([]);
    setScanError(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  }

  // ── Delete / update ───────────────────────────────────────────────────────
  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
  }

  async function updateItem(id: string, patch: { name?: string; quantity?: number | null; unit?: string | null; category?: IngredientCategory }) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await fetch(`/api/pantry/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  const selectedCount = scanned.filter((i) => i.selected).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pantry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track what you have on hand</p>
        </div>
        {items.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Scan review panel ── */}
      {scanPhase === "review" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-brand-orange" />
              <span className="font-semibold text-sm text-foreground">
                {scanned.length} item{scanned.length !== 1 ? "s" : ""} detected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAllScanned(selectedCount < scanned.length)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedCount === scanned.length ? "Deselect all" : "Select all"}
              </button>
              <button onClick={cancelScan} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Photo preview */}
            {previewUrl && (
              <div className="md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Scanned photo"
                  className="w-full h-40 md:h-full object-cover"
                />
              </div>
            )}

            {/* Ingredient checklist */}
            <div className="flex-1 divide-y divide-border max-h-80 overflow-y-auto">
              {scanned.map((item) => (
                <button
                  key={item.name}
                  onClick={() => toggleScannedItem(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary/50",
                    item.selected ? "bg-green-500/5" : ""
                  )}
                >
                  {/* Checkbox */}
                  <span className={cn(
                    "shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                    item.selected ? "bg-brand-orange border-brand-orange" : "border-border"
                  )}>
                    {item.selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>

                  {/* Name */}
                  <span className={cn(
                    "flex-1 text-sm capitalize",
                    item.selected ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {item.name}
                  </span>

                  {/* Confidence dot */}
                  <span className={cn(
                    "shrink-0 w-1.5 h-1.5 rounded-full",
                    item.confidence >= 0.85 ? "bg-green-400" :
                    item.confidence >= 0.7  ? "bg-yellow-400" : "bg-orange-400"
                  )} title={`${Math.round(item.confidence * 100)}% confident`} />
                </button>
              ))}
            </div>
          </div>

          {/* Confidence legend + Add button */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> High confidence</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Medium</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /> Lower</span>
            </div>
            <button
              onClick={addSelectedToBackground}
              disabled={addingScanned || selectedCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {addingScanned ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add {selectedCount > 0 ? `${selectedCount} ` : ""}item{selectedCount !== 1 ? "s" : ""} to pantry
            </button>
          </div>
        </div>
      )}

      {/* Scanning spinner overlay */}
      {scanPhase === "scanning" && (
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Scanning…" className="w-full max-h-48 object-cover rounded-lg opacity-60" />
          )}
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-brand-orange" />
            <span className="text-sm">Scanning for ingredients…</span>
          </div>
        </div>
      )}

      {/* Scan error */}
      {scanError && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          <X className="w-4 h-4 shrink-0" />
          {scanError}
          <button onClick={() => setScanError(null)} className="ml-auto text-xs underline hover:no-underline">Dismiss</button>
        </div>
      )}

      {/* ── Add item + Scan button ── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Add Item
          </p>
          {/* Scan button */}
          <button
            onClick={() => scanInputRef.current?.click()}
            disabled={scanPhase === "scanning"}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
              scanPhase === "scanning"
                ? "border-brand-orange/40 text-brand-orange bg-brand-orange/5"
                : "border-border text-muted-foreground hover:text-foreground hover:border-brand-orange/40 hover:bg-brand-orange/5"
            )}
          >
            {scanPhase === "scanning"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Camera className="w-3.5 h-3.5" />
            }
            Scan pantry / fridge
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>

          {/* Hidden file input — capture="environment" opens rear camera on mobile */}
          <input
            ref={scanInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleScanFile}
          />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); addItem(); }} className="flex gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g. 2 cups flour, olive oil, 3 garlic cloves…"
            className="w-full min-w-0 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
          />
          <select
            value={addCategory}
            onChange={(e) => setAddCategory(e.target.value as IngredientCategory)}
            className="flex-1 min-w-0 bg-background border border-border rounded-lg px-2 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newText.trim() || adding}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Type naturally — e.g. &ldquo;500g pasta&rdquo; or just &ldquo;olive oil&rdquo;
        </p>
      </div>

      {/* Item list — grouped by category */}
      {items.length > 0 ? (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const group = items.filter((i) => i.category === cat);
            if (group.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{group.length}</span>
                </div>
                <div className="divide-y divide-border">
                  {group.map((item) => (
                    <PantryRow
                      key={item.id}
                      item={item}
                      onUpdate={(patch) => updateItem(item.id, patch)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Package className="w-12 h-12 text-muted-foreground/20" />
          <div>
            <p className="font-medium text-foreground">Your pantry is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add ingredients above, or scan your pantry / fridge with the camera button.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function PantryRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: PantryItem;
  onUpdate: (patch: { name?: string; quantity?: number | null; unit?: string | null; category?: IngredientCategory }) => void;
  onDelete: () => void;
}) {
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [name, setName] = useState(item.name);

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

  function changeCategory(cat: IngredientCategory) {
    onUpdate({ category: cat });
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 group/row">
      {/* Category emoji — clickable select */}
      <div className="shrink-0 relative">
        <select
          value={item.category}
          onChange={(e) => changeCategory(e.target.value as IngredientCategory)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Category"
        >
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}</option>
          ))}
        </select>
        <span className="text-base leading-none select-none" title={CATEGORY_META[item.category].label}>
          {CATEGORY_META[item.category].icon}
        </span>
      </div>

      {/* Quantity */}
      <input
        type="text"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commitQty}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="qty"
        className={cn(
          "w-12 shrink-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-orange",
          "px-1 py-0.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none text-center transition-colors"
        )}
      />
      {/* Unit */}
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        onBlur={commitUnit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="unit"
        className={cn(
          "w-12 sm:w-16 shrink-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-orange",
          "px-1 py-0.5 text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors"
        )}
      />
      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(
          "flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-orange",
          "px-1 py-0.5 text-sm text-foreground focus:outline-none transition-colors"
        )}
      />
      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1 rounded text-muted-foreground/0 group-hover/row:text-muted-foreground/40 hover:!text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
        aria-label="Remove"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

