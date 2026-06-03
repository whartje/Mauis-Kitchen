import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CatIcon } from "@/components/ui/cat-icon";

export const metadata = {
  title: "Maui's Kitchen — Your recipes, beautifully organized",
  description:
    "Import recipes from YouTube, Instagram, TikTok, any website, or a photo. Plan your week and generate a smart grocery list — automatically.",
  metadataBase: new URL("https://www.mauis-kitchen.com"),
  openGraph: {
    title: "Maui's Kitchen — Your recipes, beautifully organized",
    description:
      "Import recipes from YouTube, Instagram, TikTok, any website, or a photo. Plan your week and generate a smart grocery list — automatically.",
    url: "https://www.mauis-kitchen.com",
    siteName: "Maui's Kitchen",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maui's Kitchen — Your recipes, beautifully organized",
    description:
      "Import recipes from YouTube, Instagram, TikTok, any website, or a photo. Plan your week and generate a smart grocery list — automatically.",
  },
  alternates: {
    canonical: "https://www.mauis-kitchen.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": "https://www.mauis-kitchen.com/#app",
      name: "Maui's Kitchen",
      url: "https://www.mauis-kitchen.com",
      description:
        "Import recipes from YouTube, Instagram, TikTok, any website, or a photo. Plan your week and generate a smart grocery list — automatically.",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, iOS, Android",
      offers: [
        {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          name: "Free plan",
        },
        {
          "@type": "Offer",
          price: "6.99",
          priceCurrency: "USD",
          name: "Pro plan",
          billingPeriod: "P1M",
        },
      ],
      featureList: [
        "Import recipes from YouTube, Instagram, and TikTok",
        "Import recipes from any website URL",
        "Scan recipe cards and handwritten notes with photo",
        "Weekly meal planner with ingredient overlap score",
        "Automatic grocery list generation",
        "Smart pantry tracking",
        "Share grocery list via text, email, or Alexa",
      ],
    },
    {
      "@type": "Organization",
      "@id": "https://www.mauis-kitchen.com/#org",
      name: "Maui's Kitchen",
      url: "https://www.mauis-kitchen.com",
    },
    {
      "@type": "WebSite",
      "@id": "https://www.mauis-kitchen.com/#site",
      url: "https://www.mauis-kitchen.com",
      name: "Maui's Kitchen",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://www.mauis-kitchen.com/sign-up",
      },
    },
  ],
};

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white antialiased overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Every recipe,<br />
            <span className="text-[#E8834A]">from anywhere.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-xl mx-auto leading-relaxed">
            Import from YouTube, Instagram, TikTok, any website, or a photo.
            Plan your week. Generate your grocery list.<br />
            <span className="text-white/70 font-medium">All in one place.</span>
          </p>

          <div className="mt-10 flex items-center justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#E8834A] hover:bg-[#d4733c] text-white font-semibold text-base transition-all hover:scale-[1.02] shadow-lg shadow-[#E8834A]/20"
            >
              Start cooking smarter
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Import Sources Strip ─────────────────────────────────────────────── */}
      <section className="py-10 border-y border-white/5 bg-white/[0.02]">
        <p className="text-center text-xs font-semibold text-white/30 uppercase tracking-widest mb-6">
          Import recipes from anywhere
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 px-6 max-w-3xl mx-auto">
          {/* YouTube */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span className="text-sm font-medium">YouTube</span>
          </div>
          {/* Instagram */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
            <span className="text-sm font-medium">Instagram</span>
          </div>
          {/* TikTok */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.28 8.28 0 0 0 4.84 1.54V6.77a4.85 4.85 0 0 1-1.07-.08z"/>
            </svg>
            <span className="text-sm font-medium">TikTok</span>
          </div>
          {/* Any Website */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span className="text-sm font-medium">Website</span>
          </div>
          {/* Photo Scan */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="text-sm font-medium">Photo</span>
          </div>
          {/* Paste Text */}
          <div className="flex items-center gap-2.5 text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <span className="text-sm font-medium">Paste Text</span>
          </div>
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
                "Paste a cooking video URL. We pull the transcript, extract every ingredient and step, and save a clean recipe — no typing.",
              accent: "#FF6B6B",
            },
            {
              emoji: "📱",
              title: "Grab it from Instagram or TikTok",
              description:
                "Drop in a Reel or TikTok link and we parse the caption and audio. Social cooking content, finally searchable.",
              accent: "#E1306C",
            },
            {
              emoji: "📷",
              title: "Snap a photo of anything",
              description:
                "Scan a recipe card, screenshot, or handwritten note to save it. Or snap your fridge, pantry, or a receipt to update what you have.",
              accent: "#A78BFA",
            },
            {
              emoji: "📅",
              title: "Plan your week visually",
              description:
                "Drag recipes into a weekly grid. Your ingredient overlap score shows how much a week of meals shares the same staples — less shopping, less waste.",
              accent: "#E8834A",
            },
            {
              emoji: "🛒",
              title: "One-tap grocery list",
              description:
                "Your meal plan becomes a sorted, categorized shopping list in one tap. Share via text, email, Google Tasks, or Alexa.",
              accent: "#34D399",
            },
            {
              emoji: "🥦",
              title: "Smart pantry tracking",
              description:
                "Snap your fridge, pantry shelves, or a grocery receipt — we update your pantry automatically and flag what you own on your shopping list.",
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
              desc: "Paste a URL, scan a photo, or drop in text. We extract ingredients, steps, and nutrition automatically.",
            },
            {
              step: "02",
              title: "Build your week",
              desc: "Add recipes to your plan. We surface ingredient overlap so a full week of meals shares the same pantry staples.",
            },
            {
              step: "03",
              title: "Shop smart",
              desc: "One tap generates your sorted grocery list, cross-checked against your pantry so you only buy what you need.",
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
            Beyond the bookmark
          </h2>
          <p className="mt-3 text-white/50 max-w-lg mx-auto">
            Most recipe apps save a link and call it done. Maui&apos;s Kitchen extracts, structures, plans, and shops — all in one place.
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
                ["AI nutrition analysis", false, true],
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
          <div className="flex flex-col bg-white/[0.03] border border-white/8 rounded-2xl p-8">
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
              className="mt-auto block text-center py-3 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 text-sm font-semibold transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col bg-gradient-to-b from-[#E8834A]/10 to-transparent border border-[#E8834A]/30 rounded-2xl p-8">
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
                "AI nutrition analysis — calories, protein, macros per recipe",
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
              className="mt-auto block text-center py-3 rounded-xl bg-[#E8834A] hover:bg-[#d4733c] text-white text-sm font-semibold transition-colors"
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
            Get started
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
