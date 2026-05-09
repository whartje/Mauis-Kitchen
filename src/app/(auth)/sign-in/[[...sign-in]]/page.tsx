import { SignIn } from "@clerk/nextjs";
import { CatIcon } from "@/components/ui/cat-icon";

const FEATURES = [
  {
    icon: "🔗",
    title: "Import from anywhere",
    desc: "Paste a URL, scan a photo, or type a recipe — we extract everything automatically.",
  },
  {
    icon: "📅",
    title: "Plan your whole week",
    desc: "Drag recipes into a weekly calendar and see ingredient overlap at a glance.",
  },
  {
    icon: "🛒",
    title: "Auto grocery list",
    desc: "One tap turns your meal plan into a sorted, categorized shopping list.",
  },
  {
    icon: "🥦",
    title: "Smart pantry tracking",
    desc: "Items you already have are flagged on your list so you never double-buy.",
  },
];

export default function SignInPage() {
  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left column — branding + feature bullets (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-between px-14 xl:px-20 py-12 bg-card border-r border-border w-[480px] xl:w-[540px] shrink-0 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-brand-orange/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-56 h-56 bg-brand-orange/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <CatIcon className="w-11 h-11" />
            <h1 className="font-display text-2xl text-foreground tracking-tight">
              Maui&apos;s Kitchen
            </h1>
          </div>

          {/* Hero copy */}
          <p className="text-3xl xl:text-4xl font-semibold text-foreground leading-tight mb-3">
            Your recipes,<br />
            <span className="text-brand-orange">beautifully organized.</span>
          </p>
          <p className="text-muted-foreground text-base mb-10 leading-relaxed">
            Import from any site, plan your week, and generate your grocery list — all in one place.
          </p>

          {/* Feature list */}
          <ul className="space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="text-2xl mt-0.5 shrink-0 leading-none">{f.icon}</span>
                <div>
                  <p className="font-semibold text-foreground text-sm">{f.title}</p>
                  <p className="text-muted-foreground text-sm mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom tagline */}
        <p className="relative text-xs text-muted-foreground/50">
          Free to use · No credit card required
        </p>
      </div>

      {/* ── Right column — Clerk form + mobile features ── */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-10 overflow-y-auto">
        {/* Mobile: logo + tagline */}
        <div className="lg:hidden flex flex-col items-center mb-8 text-center">
          <CatIcon className="w-14 h-14 mb-3" />
          <h1 className="font-display text-2xl text-foreground tracking-tight">
            Maui&apos;s Kitchen
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your recipes, beautifully organized.
          </p>
        </div>

        <SignIn />

        {/* Mobile: feature grid below the form */}
        <div className="lg:hidden mt-10 w-full max-w-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-4">
            Everything you need
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
              >
                <span className="text-2xl leading-none">{f.icon}</span>
                <p className="text-xs font-semibold text-foreground leading-snug">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/50 text-center mt-6">
            Free to use · No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
