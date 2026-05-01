import Link from "next/link";
import { Home } from "lucide-react";
import { CatAttackIcon } from "@/components/ui/cat-attack-icon";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 text-center px-4 bg-background">
      {/* Cat */}
      <CatAttackIcon className="w-44 h-44 text-black dark:text-foreground dark:opacity-[0.15]" />

      {/* Copy */}
      <div className="space-y-2 max-w-sm">
        <p className="text-8xl font-black text-foreground/10 leading-none select-none">
          404
        </p>
        <h1 className="text-2xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This page got batted clean off the counter.{" "}
          <span className="text-foreground/60">Typical Maui.</span>
        </p>
      </div>

      {/* Action */}
      <Link
        href="/"
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-black font-semibold text-sm transition-colors"
      >
        <Home className="w-4 h-4" />
        Back to safety
      </Link>
    </div>
  );
}
