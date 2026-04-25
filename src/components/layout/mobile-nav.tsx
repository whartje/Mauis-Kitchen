"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { LayoutDashboard, BookOpen, CalendarDays, ShoppingCart, Compass, LogOut } from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/meal-plan", label: "Plan", icon: CalendarDays },
  { href: "/grocery-list", label: "Groceries", icon: ShoppingCart },
];

export function MobileNav() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-50 flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2">
          <CatIcon className="w-7 h-7 text-brand-orange" />
          <span className="font-display text-sm text-foreground">Maui&apos;s Kitchen</span>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors py-1.5 px-2 rounded-md hover:bg-red-400/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  active ? "text-brand-orange" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
