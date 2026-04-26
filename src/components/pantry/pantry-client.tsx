"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface PantryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  raw: string;
}

interface Props {
  initialItems: PantryItem[];
}

export function PantryClient({ initialItems }: Props) {
  const [items, setItems] = useState<PantryItem[]>(initialItems);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the add input when the page loads if empty
  useEffect(() => {
    if (items.length === 0) inputRef.current?.focus();
  }, []);

  // Parse "2 cups flour" → { quantity, unit, name }
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

  async function addItem() {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    const { name, quantity, unit } = parseEntry(text);
    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity, unit }),
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

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/pantry/${id}`, { method: "DELETE" });
  }

  async function updateItem(id: string, patch: { name?: string; quantity?: number | null; unit?: string | null }) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await fetch(`/api/pantry/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pantry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track what you have on hand
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Add item input */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Add Item
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); addItem(); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g. 2 cups flour, olive oil, 3 garlic cloves…"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition"
          />
          <button
            type="submit"
            disabled={!newText.trim() || adding}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          You can include quantity and unit — e.g. &ldquo;500g pasta&rdquo; or just &ldquo;olive oil&rdquo;
        </p>
      </div>

      {/* Item list */}
      {items.length > 0 ? (
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {items.map((item) => (
            <PantryRow
              key={item.id}
              item={item}
              onUpdate={(patch) => updateItem(item.id, patch)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Package className="w-12 h-12 text-muted-foreground/20" />
          <div>
            <p className="font-medium text-foreground">Your pantry is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add ingredients above to track what you have on hand
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
  onUpdate: (patch: { name?: string; quantity?: number | null; unit?: string | null }) => void;
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

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 group/row">
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
          "w-16 shrink-0 bg-transparent border-b border-transparent hover:border-border focus:border-brand-orange",
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
