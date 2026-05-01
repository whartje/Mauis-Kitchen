import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Black cat silhouette with paw raised — used on error / 404 pages.
 * Inherits colour via `currentColor`; use Tailwind text-* classes to tint it.
 */
export function CatAttackIcon({ className }: Props) {
  return (
    <svg
      viewBox="-6 -4 132 148"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* ── Tail (rendered first so it sits behind the body) ─────────────── */}
      <path
        d="M 80 108 C 108 97 115 74 104 55 C 98 43 108 28 120 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <ellipse cx="52" cy="112" rx="31" ry="22" />

      {/* ── Neck connector (smooth bridge between head and body) ─────────── */}
      <path d="M 35 84 Q 44 92 52 92 Q 60 92 69 86 L 71 110 Q 61 104 52 104 Q 43 104 35 110 Z" />

      {/* ── Head ─────────────────────────────────────────────────────────── */}
      <circle cx="46" cy="67" r="23" />

      {/* ── Left ear (viewer's left) ─────────────────────────────────────── */}
      <polygon points="30,56 22,28 44,47" />

      {/* ── Right ear (viewer's right) ───────────────────────────────────── */}
      <polygon points="55,47 64,24 70,52" />

      {/* ── Raised right arm ─────────────────────────────────────────────── */}
      <path
        d="M 69 92 C 78 74 88 54 93 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
      />

      {/* ── Raised paw pad ───────────────────────────────────────────────── */}
      <ellipse cx="94" cy="29" rx="14" ry="10" transform="rotate(-22 94 29)" />

      {/* ── Claws ────────────────────────────────────────────────────────── */}
      <path d="M 82 20 L 76 8"  fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 90 16 L 87 4"  fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 98 17 L 99 5"  fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 105 22 L 111 12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />

      {/* ── Left sitting paw ─────────────────────────────────────────────── */}
      <ellipse cx="36" cy="134" rx="14" ry="8" />
    </svg>
  );
}
