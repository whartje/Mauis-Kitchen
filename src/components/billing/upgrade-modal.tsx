"use client";

import { useState } from "react";
import { X, Check, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

const PRO_FEATURES = [
  "Unlimited recipes",
  "YouTube import · 20/month",
  "30 photo scans / month",
  "Average nutrition per serving",
  "Priority support",
];

const FREE_FEATURES = [
  "30 recipes",
  "5 photo scans / month",
  "URL & text import",
  "Pantry, grocery & meal plan",
];

export function UpgradeModal({ open, onClose, reason }: Props) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-brand-orange fill-brand-orange" />
              <span className="text-xs font-semibold text-brand-orange uppercase tracking-wider">
                Upgrade to Pro
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {reason ?? "Unlock the full kitchen"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Billing toggle */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg w-fit">
            {(["month", "year"] as const).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  interval === iv
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {iv === "month" ? "Monthly" : "Annual"}
                {iv === "year" && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1">
                    SAVE 27%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Price */}
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-bold text-foreground">
              {interval === "month" ? "$3.99" : "$2.92"}
            </span>
            <span className="text-sm text-muted-foreground mb-1.5">/ month</span>
          </div>
          {interval === "year" && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Billed as $34.99 / year
            </p>
          )}
        </div>

        {/* Feature comparison */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Free
            </p>
            {FREE_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2 mb-1.5">
                <Check className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
          <div className="bg-brand-orange/5 border border-brand-orange/20 rounded-xl px-3 py-3">
            <p className="text-xs font-semibold text-brand-orange uppercase tracking-wider mb-2">
              Pro ✦
            </p>
            {PRO_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2 mb-1.5">
                <Check className="w-3.5 h-3.5 text-brand-orange mt-0.5 shrink-0" />
                <span className="text-xs text-foreground font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-2">
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white font-semibold text-sm hover:bg-brand-orange/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                Start Pro {interval === "year" ? "· $34.99/yr" : "· $3.99/mo"}
              </>
            )}
          </button>
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Promo code? Enter it on the next screen. · Cancel any time.
          </p>
        </div>
      </div>
    </div>
  );
}
