import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CatIcon } from "@/components/ui/cat-icon";

export const metadata = {
  title: "Maui's Kitchen — Your recipes, beautifully organized",
  description:
    "Import recipes from YouTube, Instagram, TikTok, any website, or a photo. Plan your week and generate a smart grocery list — automatically.",
};

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/recipes");

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white antialiased overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0d0d0d]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <CatIcon className="w-8 h-8" />
          <span className="font-semibold text-[15px] tracking-tight">Maui&apos;s Kitchen</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-medium bg-[#E8834A] hover:bg-[#d4733c] text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center text-center px-4 pt-40 pb-28">
        {/* Background glow */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#E8834A]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#E8834A] bg-[#E8834A]/10 border border-[#E8834A]/20 rounded-full px-3 py-1 mb-6">
            🐱 Free to use · No credit card required
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Every recipe,<br />
            <span className="text-[#E8834A]">from anywhere.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-xl mx-auto leading-relaxed">
            Import from YouTube, Instagram, TikTok, any website, or a photo.
            Plan your week. Generate your grocery list. All in one place.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#E8834A] hover:bg-[#d4733c] text-white font-semibold text-base transition-all hover:scale-[1.02] shadow-lg shadow-[#E8834A]/20"
            >
              Start cooking smarter
              <span className="text-lg">→</span>
            </Link>
            <Link
              href="/sign-in"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-medium text-base border border-white/10 transition-colors"
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Import Sources Strip ─────────────────────────────────────────────── */}
      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <p className="text-center text-xs font-semibold text-white/30 uppercase tracking-widest mb-6">
          Import recipes from anywhere
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 max-w-3xl mx-auto">
          {[
            { icon: "▶", label: "YouTube", color: "#FF0000" },
            { icon: "📸", label: "Instagram", color: "#E1306C" },
            { icon: "♪", label: "TikTok", color: "#69C9D0" },
            { icon: "🔗", label: "Any Website", color: "#E8834A" },
            { icon: "📷", label: "Photo Scan", color: "#A78BFA" },
            { icon: "📋", label: "Paste Text", color: "#34D399" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
              <span className="text-xl">{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Core Features ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            The recipe app that actually does the work
          </h2>
          <p className="mt-3 text-white/50 max-w-lg mx-auto">
            Most apps are glorified bookmarks. Maui&apos;s Kitchen extracts, organizes, and plans — automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              emoji: "🎬",
              title: "Import from a YouTube video",
              description:
                "Paste any cooking video URL. We pull the transcript, extract every ingredient and step, and save it as a clean recipe — no typing required.",
              accent: "#FF6B6B",
            },
            {
              emoji: "📱",
              title: "Grab it from Instagram or TikTok",
              description:
                "Drop in a Reel or TikTok link and we parse the caption and audio. Social cooking content is finally searchable and usable.",
              accent: "#E1306C",
            },
            {
              emoji: "📷",
              title: "Scan a photo or recipe card",
              description:
                "Point your camera at a printed recipe, screenshot, or handwritten card. Our AI reads it and structures it perfectly.",
              accent: "#A78BFA",
            },
            {
              emoji: "📅",
              title: "Plan your week visually",
              description:
                "Drag recipes into a day-by-day grid. See your ingredient overlap score — the higher it is, the less you need to buy.",
              accent: "#E8834A",
            },
            {
              emoji: "🛒",
              title: "One-tap grocery list",
              description:
                "Your meal plan becomes a sorted, categorized shopping list instantly. Share via text, email, Google Tasks, or Alexa.",
              accent: "#34D399",
            },
            {
              emoji: "🥦",
              title: "Smart pantry tracking",
              description:
                "Tell us what you already have. We flag those items on your list so you never buy duplicates or forget what's in the fridge.",
              accent: "#60A5FA",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="relative bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/12 transition-all"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4"
                style={{ background: `${f.accent}15` }}
              >
                {f.emoji}
              </div>
              <h3 className="font-semibold text-base text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it Works ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            From craving to cart in three steps
          </h2>
        </div>
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop) */}
          <div className="hidden sm:block absolute top-8 left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px bg-gradient-to-r from-transparent via-[#E8834A]/30 to-transparent" />

          {[
            {
              step: "01",
              title: "Import a recipe",
              desc: "Paste a URL, share from YouTube, scan a photo, or paste text. We extract everything — ingredients, steps, and nutrition.",
            },
            {
              step: "02",
              title: "Build your week",
              desc: "Add recipes to your meal plan. We show you ingredient overlap so you can plan a full week of meals that share pantry staples.",
            },
            {
              step: "03",
              title: "Shop smart",
              desc: "One tap generates your sorted grocery list. Cross-check your pantry so you only buy what you actually need.",
            },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E8834A]/10 border border-[#E8834A]/20 flex items-center justify-center mb-5">
                <span className="text-[#E8834A] font-bold text-lg">{s.step}</span>
              </div>
              <h3 className="font-semibold text-base mb-2">{s.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Differentiation ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Why not Paprika, Whisk, or Yummly?
          </h2>
          <p className="mt-3 text-white/50 max-w-lg mx-auto">
            Those apps clip recipes from the web. Maui&apos;s Kitchen goes further.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.03]">
                <th className="text-left px-6 py-4 text-white/40 font-medium">Feature</th>
                <th className="px-6 py-4 text-white/40 font-medium text-center">Other apps</th>
                <th className="px-6 py-4 font-semibold text-[#E8834A] text-center">Maui&apos;s Kitchen</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Import from any website URL", true, true],
                ["Import from YouTube videos", false, true],
                ["Import from Instagram / TikTok", false, true],
                ["Import by scanning a photo", false, true],
                ["Weekly meal plan calendar", "Some", true],
                ["Ingredient overlap scoring", false, true],
                ["Auto-generated grocery list", "Some", true],
                ["Pantry cross-reference", false, true],
                ["Google Tasks / Alexa sync", false, true],
              ].map(([feature, others, ours], i) => (
                <tr
                  key={String(feature)}
                  className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}
                >
                  <td className="px-6 py-3.5 text-white/70">{feature}</td>
                  <td className="px-6 py-3.5 text-center">
                    {others === true ? (
                      <span className="text-white/30">✓</span>
                    ) : others === false ? (
                      <span className="text-white/20">✗</span>
                    ) : (
                      <span className="text-white/30 text-xs">{others}</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    {ours === true ? (
                      <span className="text-[#E8834A] font-bold">✓</span>
                    ) : (
                      <span className="text-white/30">✗</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white/[0.02] border-y border-white/5">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, honest pricing</h2>
          <p className="mt-3 text-white/50">Start free. Upgrade when you need more.</p>
        </div>

        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <p className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3">Free</p>
            <p className="text-4xl font-bold mb-1">$0</p>
            <p className="text-sm text-white/40 mb-8">Forever free, no card needed</p>
            <ul className="space-y-3 mb-8">
              {[
                "25 saved recipes",
                "5 YouTube imports / month",
                "5 social / photo imports / month",
                "Weekly meal planner",
                "Grocery list generator",
                "Pantry tracking",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                  <span className="text-[#E8834A] text-xs">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block text-center py-2.5 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 text-sm font-medium transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative bg-gradient-to-b from-[#E8834A]/10 to-transparent border border-[#E8834A]/30 rounded-2xl p-8">
            <div className="absolute -top-3 left-6">
              <span className="text-xs font-bold bg-[#E8834A] text-white px-3 py-1 rounded-full">
                Most popular
              </span>
            </div>
            <p className="text-sm font-semibold text-[#E8834A] uppercase tracking-widest mb-3">Pro</p>
            <p className="text-4xl font-bold mb-1">
              $4<span className="text-xl text-white/40">/mo</span>
            </p>
            <p className="text-sm text-white/40 mb-8">Billed monthly · Cancel anytime</p>
            <ul className="space-y-3 mb-8">
              {[
                "Unlimited saved recipes",
                "30 YouTube imports / month",
                "30 social / photo imports / month",
                "AI nutrition analysis",
                "Everything in Free",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                  <span className="text-[#E8834A] text-xs">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block text-center py-2.5 rounded-xl bg-[#E8834A] hover:bg-[#d4733c] text-white text-sm font-semibold transition-colors"
            >
              Start Pro free trial
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section className="py-32 px-4 text-center relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[300px] bg-[#E8834A]/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Ready to cook smarter?
          </h2>
          <p className="text-white/50 mb-10 max-w-md mx-auto">
            Join thousands of home cooks who&apos;ve ditched the recipe bookmark chaos.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#E8834A] hover:bg-[#d4733c] text-white font-semibold text-lg transition-all hover:scale-[1.02] shadow-xl shadow-[#E8834A]/20"
          >
            Get started — it&apos;s free
            <span>→</span>
          </Link>
          <p className="mt-4 text-xs text-white/25">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/25">
          <div className="flex items-center gap-2">
            <CatIcon className="w-5 h-5 opacity-50" />
            <span>Maui&apos;s Kitchen</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/pricing" className="hover:text-white/50 transition-colors">Pricing</Link>
            <Link href="/sign-in" className="hover:text-white/50 transition-colors">Sign in</Link>
          </div>
          <span>© {new Date().getFullYear()} Maui&apos;s Kitchen</span>
        </div>
      </footer>

    </div>
  );
}
