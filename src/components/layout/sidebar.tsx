"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Package,
  Settings,
  Compass,
} from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/grocery-list", label: "Grocery List", icon: ShoppingCart },
];

export function Sidebar() {
  const pathname = usePathname();

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

      {/* Bottom: settings + user */}
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
          <span className="text-sm text-muted-foreground">Account</span>
        </div>
      </div>
    </aside>
  );
}
