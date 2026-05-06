"use client";

import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Walking cat silhouette — inline SVG so it stays crisp at any size.
 * brightness-0 dark:invert mirrors the original PNG behaviour:
 * always black on light mode, always white on dark mode.
 * The outer className controls size only (w-* h-*).
 */
export function CatIcon({ className }: Props) {
  return (
    <span className={cn("inline-flex items-center justify-center shrink-0", className)}>
      <svg
        viewBox="0 0 120 80"
        xmlns="http://www.w3.org/2000/svg"
        fill="black"
        className="w-full h-full brightness-0 dark:invert"
        aria-label="Maui's Kitchen"
      >
        <path d="
          M 0 0
          C 4 7, 9 17, 14 26
          C 16 31, 17 35, 18 38
          C 35 29, 58 24, 83 28
          C 85 27, 86 24, 87 21
          C 88 18, 90 16, 93 15
          L 95 12
          L 98 16
          C 100 19, 102 22, 104 26
          C 110 32, 116 36, 119 40
          C 119 43, 118 47, 115 50
          C 112 53, 109 54, 106 54
          L 109 79
          L 97 79
          L 94 54
          C 92 54, 90 54, 87 54
          L 90 79
          L 79 79
          L 75 54
          C 67 55, 56 56, 48 56
          C 44 56, 40 56, 35 56
          L 35 79
          L 27 79
          L 24 56
          L 20 56
          L 22 79
          L 13 79
          L 10 56
          C 10 49, 12 43, 14 40
          C 11 32, 5 17, 0 0
          Z
        " />
      </svg>
    </span>
  );
}
