"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Package,
  Settings,
  Compass,
  LogOut,
  Zap,
} from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/grocery-list", label: "Grocery List", icon: ShoppingCart },
];

interface PlanStatus {
  plan: "FREE" | "PRO";
  isPro: boolean;
  recipeCount: number;
  recipeLimit: number | null;
}

function usePlanStatus() {
  const [status, setStatus] = useState<PlanStatus | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});
  }, []);

  return status;
}

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const plan = usePlanStatus();

  const recipeUsagePct =
    plan && plan.recipeLimit ? Math.min((plan.recipeCount / plan.recipeLimit) * 100, 100) : 0;

  return (
    <aside className="hidden md:flex flex-col w-56 bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <CatIcon className="w-14 h-14 text-brand-orange" />
        <span className="font-display text-lg text-foreground leading-tight">
          Maui&apos;s Kitchen
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-brand-orange/15 text-brand-orange"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Plan status */}
      {plan && !plan.isPro && plan.recipeLimit && (
        <div className="mx-3 mb-2 bg-secondary/60 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {plan.recipeCount} / {plan.recipeLimit} recipes
            </span>
            <Link
              href="/pricing"
              className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-orange hover:text-brand-orange/80 transition-colors"
            >
              <Zap className="w-3 h-3 fill-brand-orange" />
              Upgrade
            </Link>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                recipeUsagePct >= 90 ? "bg-red-400" : "bg-brand-orange",
              )}
              style={{ width: `${recipeUsagePct}%` }}
            />
          </div>
        </div>
      )}

      {plan?.isPro && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 px-3 py-2 bg-brand-orange/8 border border-brand-orange/20 rounded-xl">
          <Zap className="w-3.5 h-3.5 text-brand-orange fill-brand-orange shrink-0" />
          <span className="text-xs font-semibold text-brand-orange">Pro plan</span>
        </div>
      )}

      {/* Bottom: settings + user + logout */}
      <div className="px-3 py-4 border-t border-border space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-brand-orange/15 text-brand-orange"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-sm text-muted-foreground flex-1">Account</span>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
