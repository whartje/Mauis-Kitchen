"use client";

import { X, LayoutDashboard, BookOpen, Compass, CalendarDays, Package, ShoppingCart, Settings } from "lucide-react";

const TABS = [
  {
    icon: LayoutDashboard,
    name: "Home",
    color: "text-brand-orange",
    bg: "bg-brand-orange/10",
    description:
      "Your dashboard. See this week's planned meals at a glance, your most recently imported recipes, and quickly import anything new with the buttons in the top right — paste a URL, scan a photo, type a recipe, or drop in a YouTube link (Pro) to let Claude read the video's transcript and build the recipe for you.",
  },
  {
    icon: BookOpen,
    name: "Recipes",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    description:
      "Your full recipe library. Filter by diet, cook time, or cuisine using the chips at the top. Open any recipe for step-by-step instructions — tap the ☀️ icon to keep your screen on while you cook, or the 📅 icon to add it straight to your meal plan. Recipes imported from YouTube show a link back to the original video.",
  },
  {
    icon: Compass,
    name: "Discover",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    description:
      "Browse hand-picked cooking sites and search for new recipes without leaving the app. Switch between Search and Sites mode using the tabs at the top. Tap the + button on any result to save it to your library.",
  },
  {
    icon: CalendarDays,
    name: "Meal Plan",
    color: "text-green-400",
    bg: "bg-green-400/10",
    description:
      "Plan your week by dropping recipes into Breakfast, Lunch, Dinner, or Snack slots. Each slot can hold multiple recipes. Use the 🔒 lock icon to keep a favorite in place when re-planning. The Ingredient Reuse badge shows how much your meals share — higher overlap means a shorter shopping trip.",
  },
  {
    icon: Package,
    name: "Pantry",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    description:
      "Track what you already have at home. Add items by typing or by tapping Scan Pantry / Fridge to use your camera. Set an expiry date on any item by tapping the 🗓 calendar icon on its row — the row turns red when something has expired.",
  },
  {
    icon: ShoppingCart,
    name: "Grocery List",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    description:
      "Tap Generate List to turn your meal plan into a categorized shopping list. Items already in your pantry are automatically flagged so you don't double-buy. Use the ← → arrows to navigate lists for different weeks, and check off items as you shop.",
  },
  {
    icon: Settings,
    name: "Settings",
    color: "text-muted-foreground",
    bg: "bg-secondary",
    description:
      "Pick your theme (light or dark), choose which day your week starts on (Sunday, Monday, or Saturday — this affects the Meal Plan calendar and date labels), set a default dietary filter for your recipe library, and find instructions for installing the app on your phone's home screen.",
  },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AppGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — scrollable sheet, centred on larger screens */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App guide"
        className="fixed inset-x-4 top-[4vh] bottom-[4vh] z-50 mx-auto max-w-lg flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">How Maui&apos;s Kitchen Works</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              A quick tour of each tab — you can always reopen this from the Home page.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground ml-4 shrink-0"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab descriptions */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {TABS.map(({ icon: Icon, name, color, bg, description }) => (
            <div key={name} className="flex gap-3">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  );
}
