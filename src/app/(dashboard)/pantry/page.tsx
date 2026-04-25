import { Package } from "lucide-react";
import Link from "next/link";

export default function PantryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Pantry</h1>
      <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
        <Package className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="font-medium text-foreground">Pantry mode coming in Phase 4</p>
          <p className="text-sm text-muted-foreground mt-1">
            Enter what&apos;s in your fridge and we&apos;ll find recipes you can make right now.
          </p>
        </div>
        <Link
          href="/recipes"
          className="bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          Browse Recipes
        </Link>
      </div>
    </div>
  );
}
