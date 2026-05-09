"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  "Up to 30 recipes",
  "URL & text import",
  "5 photo scans / month",
  "Meal planning",
  "Pantry & grocery list",
  "Discovery page",
];

const PRO_FEATURES = [
  "Unlimited recipes",
  "URL & text import",
  "30 photo scans / month",
  "Meal planning",
  "Pantry & grocery list",
  "Discovery page",
  "Avg. nutrition per serving ✦",
  "Priority support",
];

export default function PricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">Simple pricing</h1>
        <p className="text-muted-foreground">
          Start free, upgrade when you need more.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium transition-all",
                interval === iv
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {iv === "month" ? "Monthly" : "Annual"}
              {iv === "year" && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                  SAVE 27%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Free */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
          <div className="mb-5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Free
            </p>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-foreground">$0</span>
              <span className="text-sm text-muted-foreground mb-1.5">/ month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">No credit card required</p>
          </div>

          <ul className="flex-1 space-y-2.5 mb-6">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Current plan
          </button>
        </div>

        {/* Pro */}
        <div className="bg-card border-2 border-brand-orange/40 rounded-2xl p-6 flex flex-col relative overflow-hidden">
          {/* Glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-orange/10 rounded-full blur-2xl pointer-events-none" />

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-brand-orange uppercase tracking-wider">
                Pro
              </p>
              <Zap className="w-3.5 h-3.5 text-brand-orange fill-brand-orange" />
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-foreground">
                {interval === "month" ? "$3.99" : "$2.92"}
              </span>
              <span className="text-sm text-muted-foreground mb-1.5">/ month</span>
            </div>
            {interval === "year" ? (
              <p className="text-xs text-muted-foreground mt-1">Billed as $34.99 / year</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">or $34.99/yr (save 27%)</p>
            )}
          </div>

          <ul className="flex-1 space-y-2.5 mb-6">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check
                  className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    f.includes("✦") ? "text-brand-orange" : "text-emerald-400",
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    f.includes("✦") ? "text-foreground font-medium" : "text-foreground",
                  )}
                >
                  {f}
                </span>
              </li>
            ))}
          </ul>

          {error && (
            <p className="text-xs text-red-400 text-center mb-2">{error}</p>
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
                Upgrade to Pro
              </>
            )}
          </button>

          <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
            Have a promo code? Enter it at checkout. · Cancel any time.
          </p>
        </div>
      </div>

      {/* FAQ note */}
      <p className="text-center text-xs text-muted-foreground/50 mt-8">
        Founding member? Use your promo code at checkout for your first year free.
      </p>
    </div>
  );
}
