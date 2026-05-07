import { SignIn } from "@clerk/nextjs";
import { CatIcon } from "@/components/ui/cat-icon";

const FEATURES = [
  {
    icon: "🔗",
    title: "Import from anywhere",
    desc: "Paste a URL from any recipe site and we extract ingredients, times, and steps automatically.",
  },
  {
    icon: "📅",
    title: "Plan your whole week",
    desc: "Drop recipes into a weekly calendar and see ingredient overlap at a glance.",
  },
  {
    icon: "🛒",
    title: "Auto-generate your grocery list",
    desc: "One tap turns your meal plan into a sorted, categorized shopping list.",
  },
  {
    icon: "🥦",
    title: "Track your pantry",
    desc: "Items you already have are highlighted on your list so you never double-buy.",
  },
];

export default function SignInPage() {
  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left column — branding + feature bullets (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-center px-14 xl:px-20 bg-card border-r border-border w-[460px] xl:w-[520px] shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <CatIcon className="w-12 h-12" />
          <h1 className="font-display text-3xl text-foreground tracking-tight">
            Maui&apos;s Kitchen
          </h1>
        </div>

        <p className="text-lg text-muted-foreground mb-10 leading-snug">
          Your recipes, your week, your list —{" "}
          <span className="text-foreground font-medium">all in one place.</span>
        </p>

        <ul className="space-y-6">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-4">
              <span className="text-2xl mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <p className="font-semibold text-foreground text-sm">{f.title}</p>
                <p className="text-muted-foreground text-sm mt-0.5 leading-snug">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right column — Clerk form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Mobile: compact logo + tagline above the form */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <CatIcon className="w-16 h-16 mb-3" />
          <h1 className="font-display text-3xl text-foreground tracking-tight">
            Maui&apos;s Kitchen
          </h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Your recipes, your week, your list.
          </p>
        </div>

        <SignIn />
      </div>
    </div>
  );
}
