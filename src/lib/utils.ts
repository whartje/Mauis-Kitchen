import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function difficultyLabel(d: string): string {
  return d.charAt(0) + d.slice(1).toLowerCase();
}

export function difficultyColor(d: string): string {
  switch (d) {
    case "EASY": return "text-green-400";
    case "HARD": return "text-red-400";
    default: return "text-yellow-400";
  }
}
