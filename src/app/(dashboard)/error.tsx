"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";
import { CatAttackIcon } from "@/components/ui/cat-attack-icon";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 text-center px-4">
      {/* Cat */}
      <CatAttackIcon className="w-40 h-40 text-black dark:text-foreground dark:opacity-[0.15]" />

      {/* Copy */}
      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Maui knocked this off the shelf.{" "}
          <span className="text-foreground/60">
            Don&apos;t worry — it happens to the best of us.
          </span>
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono pt-1">
            {error.digest}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary text-sm font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
