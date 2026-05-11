"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Sun, Moon, LogOut, Settings2, Users,
  Check, ChevronRight, CreditCard, Zap, Loader2,
  Smartphone, CheckCircle2, Calendar, MessageSquarePlus, Send,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface PlanStatus {
  plan: "FREE" | "PRO";
  isPro: boolean;
  recipeCount: number;
  recipeLimit: number | null;
  photoImportsThisMonth: number;
  photoLimit: number;
  currentPeriodEnd: string | null;
}

// ── Local-storage keys ────────────────────────────────────────────────────────
const LS_DIETARY    = "mauisKitchen_dietaryDefault";
const LS_SERVINGS   = "mauisKitchen_defaultServings";
const LS_WEEK_START = "mauisKitchen_weekStartDay";

type WeekStartDay = "monday" | "sunday" | "saturday";
const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: "monday",   label: "Monday" },
  { value: "sunday",   label: "Sunday" },
  { value: "saturday", label: "Saturday" },
];

// ── Dietary filter options (matches recipe-library filter values) ─────────────
const DIETARY_OPTIONS = [
  { value: "",             label: "None" },
  { value: "vegan",        label: "Vegan" },
  { value: "vegetarian",   label: "Vegetarian" },
  { value: "gluten-free",  label: "Gluten-Free" },
  { value: "dairy-free",   label: "Dairy-Free" },
  { value: "high-protein", label: "High Protein" },
  { value: "paleo",        label: "Paleo" },
  { value: "keto",         label: "Keto / Low Carb" },
];

export function SettingsClient() {
  const { theme, setTheme, mounted } = useTheme();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "preferences";

  // Preferences — hydrated from localStorage after mount
  const [dietaryDefault, setDietaryDefault] = useState("");
  const [defaultServings, setDefaultServings] = useState(2);
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>("monday");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Install-app detection (runs client-side only)
  const [installState, setInstallState] = useState<
    "loading" | "installed" | "ios-safari" | "ios-other" | "other"
  >("loading");

  // Billing status
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Feedback
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setPlanStatus(d))
      .catch(() => {});
  }, []);

  // Detect install state
  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (standalone) { setInstallState("installed"); return; }
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    // CriOS = Chrome for iOS, FxiOS = Firefox for iOS — neither can add PWA icons
    const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isSafari) { setInstallState("ios-safari"); return; }
    if (isIOS)    { setInstallState("ios-other");  return; }
    setInstallState("other");
  }, []);

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const dietary  = localStorage.getItem(LS_DIETARY)  ?? "";
      const servings = localStorage.getItem(LS_SERVINGS);
      const weekDay  = localStorage.getItem(LS_WEEK_START) as WeekStartDay | null;
      setDietaryDefault(dietary);
      setDefaultServings(servings ? Math.max(1, Math.min(12, parseInt(servings, 10))) : 2);
      if (weekDay && ["monday","sunday","saturday"].includes(weekDay)) setWeekStartDay(weekDay);
    } catch {}
    setPrefsLoaded(true);
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setPortalLoading(false);
  }

  async function submitFeedback() {
    if (feedbackText.trim().length < 5) return;
    setFeedbackLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedbackText.trim() }),
      });
      setFeedbackDone(true);
      setFeedbackText("");
      setTimeout(() => {
        setFeedbackDone(false);
        setFeedbackOpen(false);
      }, 2500);
    } finally {
      setFeedbackLoading(false);
    }
  }

  function saveDietary(value: string) {
    setDietaryDefault(value);
    try { localStorage.setItem(LS_DIETARY, value); } catch {}
  }

  function saveServings(value: number) {
    const clamped = Math.max(1, Math.min(12, value));
    setDefaultServings(clamped);
    try { localStorage.setItem(LS_SERVINGS, String(clamped)); } catch {}
  }

  function saveWeekStart(value: WeekStartDay) {
    setWeekStartDay(value);
    try { localStorage.setItem(LS_WEEK_START, value); } catch {}
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Personalize Maui&apos;s Kitchen</p>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Sun className="w-3.5 h-3.5" />} title="Appearance" />
        <Card>
          {/* Theme row */}
          <Row>
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mounted ? (theme === "dark" ? "Dark mode active" : "Light mode active") : "…"}
              </p>
            </div>
            {mounted ? (
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <ThemeBtn active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="w-3.5 h-3.5" />} label="Dark" />
                <ThemeBtn active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="w-3.5 h-3.5" />} label="Light" />
              </div>
            ) : (
              <div className="h-9 w-32 bg-secondary rounded-lg animate-pulse" />
            )}
          </Row>
        </Card>
      </section>

      {/* ── Install App ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Smartphone className="w-3.5 h-3.5" />} title="Install App" />
        <Card>
          {installState === "installed" && (
            <div className="px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">You&apos;re using the app</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Maui&apos;s Kitchen is already on your home screen — enjoy!
                </p>
              </div>
            </div>
          )}

          {installState === "ios-safari" && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">Add to your home screen</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Three taps and it works like a real app — no App Store needed.
                </p>
              </div>
              <ol className="space-y-3">
                {[
                  { n: 1, icon: "⬆️", text: <>Tap the <strong className="text-foreground">Share</strong> button at the bottom of Safari (the box with an arrow pointing up)</> },
                  { n: 2, icon: "📋", text: <>Scroll down the menu and tap <strong className="text-foreground">Add to Home Screen</strong></> },
                  { n: 3, icon: "✅", text: <>Tap <strong className="text-foreground">Add</strong> in the top-right corner</> },
                ].map(({ n, icon, text }) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {n}
                    </span>
                    <span className="text-sm text-muted-foreground leading-snug">
                      <span className="mr-1">{icon}</span>{text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {installState === "ios-other" && (
            <div className="px-5 py-4 flex items-start gap-3">
              <span className="text-xl shrink-0">🧭</span>
              <div>
                <p className="text-sm font-medium text-foreground">Open in Safari to install</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Home-screen installation only works in <strong className="text-foreground">Safari</strong>.
                  Tap the share icon in your current browser and choose{" "}
                  <strong className="text-foreground">&ldquo;Open in Safari&rdquo;</strong>, then follow the steps there.
                </p>
              </div>
            </div>
          )}

          {(installState === "other" || installState === "loading") && (
            <div className="px-5 py-4 flex items-start gap-3">
              <span className="text-xl shrink-0">📱</span>
              <div>
                <p className="text-sm font-medium text-foreground">Install on your iPhone</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Open <strong className="text-foreground">mauis-kitchen.com</strong> in{" "}
                  <strong className="text-foreground">Safari on your iPhone</strong>, then tap the Share button ⬆️,
                  choose <strong className="text-foreground">&ldquo;Add to Home Screen&rdquo;</strong>, and tap{" "}
                  <strong className="text-foreground">Add</strong>.
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ── Preferences ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Settings2 className="w-3.5 h-3.5" />} title="Preferences" />
        <Card>
          {/* Default serving size */}
          <Row>
            <div>
              <p className="text-sm font-medium text-foreground">Default serving size</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pre-filled when scaling recipes &amp; planning meals
              </p>
            </div>
            {prefsLoaded ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => saveServings(defaultServings - 1)}
                  disabled={defaultServings <= 1}
                  className="w-8 h-8 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center text-foreground disabled:opacity-40 transition-colors text-lg leading-none"
                >−</button>
                <span className="text-sm font-semibold text-foreground w-5 text-center">{defaultServings}</span>
                <button
                  onClick={() => saveServings(defaultServings + 1)}
                  disabled={defaultServings >= 12}
                  className="w-8 h-8 rounded-full bg-secondary hover:bg-brand-orange/20 flex items-center justify-center text-foreground disabled:opacity-40 transition-colors text-lg leading-none"
                >+</button>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="h-8 w-28 bg-secondary rounded-lg animate-pulse shrink-0" />
            )}
          </Row>

          <Divider />

          {/* Dietary default */}
          <div className="px-5 py-4">
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">Default dietary filter</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-applied when you open Recipes with no filters active
              </p>
            </div>
            {prefsLoaded ? (
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => saveDietary(value)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      dietaryDefault === value
                        ? "bg-brand-orange/15 border-brand-orange/40 text-brand-orange"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {dietaryDefault === value && <Check className="w-3 h-3" />}
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                {[1,2,3].map(i => <div key={i} className="h-8 w-20 bg-secondary rounded-full animate-pulse" />)}
              </div>
            )}
          </div>

          <Divider />

          {/* Week start day — stacked so it never squeezes on mobile */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Week starts on</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sets the first day in your meal plan calendar
                </p>
              </div>
            </div>
            {prefsLoaded ? (
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 w-fit">
                {WEEK_START_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => saveWeekStart(value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      weekStartDay === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="h-9 w-48 bg-secondary rounded-lg animate-pulse" />
            )}
          </div>
        </Card>
      </section>

      {/* ── Billing ─────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<CreditCard className="w-3.5 h-3.5" />} title="Billing" />
        <Card>
          <Row>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                planStatus?.isPro ? "bg-brand-orange/15" : "bg-secondary",
              )}>
                <Zap className={cn(
                  "w-4 h-4",
                  planStatus?.isPro ? "text-brand-orange fill-brand-orange" : "text-muted-foreground",
                )} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {planStatus?.isPro ? "Pro plan" : "Free plan"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {planStatus?.isPro
                    ? planStatus.currentPeriodEnd
                      ? `Renews ${new Date(planStatus.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : "Active"
                    : `${planStatus?.recipeCount ?? "—"} / ${planStatus?.recipeLimit ?? 30} recipes · ${planStatus?.photoImportsThisMonth ?? 0} / ${planStatus?.photoLimit ?? 5} photo scans this month`
                  }
                </p>
              </div>
            </div>
            {planStatus?.isPro ? (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors shrink-0 disabled:opacity-60"
              >
                {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Manage
                {!portalLoading && <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <a
                href="/pricing"
                className="flex items-center gap-1 text-xs font-semibold text-brand-orange border border-brand-orange/30 bg-brand-orange/8 rounded-lg px-3 py-1.5 hover:bg-brand-orange/15 transition-colors shrink-0"
              >
                <Zap className="w-3 h-3 fill-brand-orange" />
                Upgrade
              </a>
            )}
          </Row>

          {!planStatus?.isPro && (
            <>
              <Divider />
              <div className="px-5 py-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Have a founding member code? Use it when upgrading at checkout.
                </p>
                <a
                  href="/pricing"
                  className="text-xs font-medium text-brand-orange hover:text-brand-orange/80 transition-colors"
                >
                  View Pro features →
                </a>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ── Feedback ────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<MessageSquarePlus className="w-3.5 h-3.5" />} title="Feedback" />
        <Card>
          {!feedbackOpen && !feedbackDone && (
            <button
              onClick={() => setFeedbackOpen(true)}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-secondary/50 transition-colors group"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Share a suggestion</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ideas, feature requests, or anything on your mind
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}

          {feedbackOpen && !feedbackDone && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm font-medium text-foreground">What&apos;s on your mind?</p>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Type your suggestion, idea, or anything you'd like to see improved…"
                rows={4}
                autoFocus
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition resize-none"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setFeedbackOpen(false); setFeedbackText(""); }}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={feedbackText.trim().length < 5 || feedbackLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {feedbackLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Send
                </button>
              </div>
            </div>
          )}

          {feedbackDone && (
            <div className="px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Thanks for the feedback!</p>
                <p className="text-xs text-muted-foreground mt-0.5">We read every suggestion.</p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<LogOut className="w-3.5 h-3.5" />} title="Account" />
        <Card>
          {/* User info */}
          <Row>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt={user.fullName ?? ""}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center shrink-0">
                  <span className="text-brand-orange font-bold text-sm">
                    {user?.firstName?.[0] ?? "?"}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.fullName ?? "Loading…"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress ?? ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => openUserProfile()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors shrink-0"
            >
              Manage
              <ChevronRight className="w-3 h-3" />
            </button>
          </Row>

          <Divider />

          {/* Log out */}
          <Row>
            <div>
              <p className="text-sm font-medium text-foreground">Sign out</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sign out of all sessions on this device</p>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 border border-red-400/20 hover:border-red-400/30 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </Row>
        </Card>
      </section>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border mx-5" />;
}

function ThemeBtn({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
