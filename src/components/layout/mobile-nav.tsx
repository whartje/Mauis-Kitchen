"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, CalendarDays, ShoppingCart, Compass, Package, Settings } from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",   label: "Home",      icon: LayoutDashboard },
  { href: "/recipes",     label: "Recipes",   icon: BookOpen },
  { href: "/discover",    label: "Discover",  icon: Compass },
  { href: "/meal-plan",   label: "Plan",      icon: CalendarDays },
  { href: "/pantry",      label: "Pantry",    icon: Package },
  { href: "/grocery-list",label: "Groceries", icon: ShoppingCart },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-50">
        {/* Fills the iOS status bar (time/battery/signal) — height = safe-area-inset-top */}
        <div className="h-safe-top" />
        {/* Actual header content row */}
        <div className="h-12 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <CatIcon className="w-7 h-7 text-brand-orange" />
            <span className="font-display text-sm text-foreground">Maui&apos;s Kitchen</span>
          </div>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-1.5 text-xs py-1.5 px-2 rounded-md transition-colors",
              pathname.startsWith("/settings")
                ? "text-brand-orange bg-brand-orange/10"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand-orange" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </div>
        {/* Fills the iOS home indicator / gesture bar — height = safe-area-inset-bottom */}
        <div className="h-safe-bottom" />
      </nav>
    </>
  );
}
