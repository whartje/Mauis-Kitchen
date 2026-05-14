"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Sun, Moon, LogOut, Settings2, Users,
  Check, ChevronRight, CreditCard, Zap, Loader2,
  Smartphone, CheckCircle2, Calendar, MessageSquarePlus, Send, List,
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
const LS_DIETARY       = "mauisKitchen_dietaryDefault";
const LS_SERVINGS      = "mauisKitchen_defaultServings";
const LS_WEEK_START    = "mauisKitchen_weekStartDay";
const LS_SHARE_PREFIX  = "mauisKitchen_sharePrefix";
const DEFAULT_SHARE_PREFIX = "Add these to the grocery list:";

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
  const [sharePrefix, setSharePrefix] = useState(DEFAULT_SHARE_PREFIX);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Install-app detection (runs client-side only)
  const [installState, setInstallState] = useState<
    "loading" | "installed" | "ios-safari" | "ios-other" | "android" | "other"
  >("loading");

  // Billing status
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Feedback
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  // Alexa Skill
  const [alexaLinked, setAlexaLinked] = useState<boolean | null>(null);

  // Google Tasks
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);


  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setPlanStatus(d))
      .catch(() => {});
  }, []);

  // Load Alexa + Google status on mount; also detect Google OAuth callback result
  useEffect(() => {
    loadAlexaStatus();
    loadGoogleStatus();
    // If returning from Google OAuth, refresh status
    const googleParam = new URLSearchParams(window.location.search).get("google");
    if (googleParam === "connected") loadGoogleStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (/Android/.test(ua)) { setInstallState("android"); return; }
    setInstallState("other");
  }, []);

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const dietary  = localStorage.getItem(LS_DIETARY)  ?? "";
      const servings = localStorage.getItem(LS_SERVINGS);
      const weekDay  = localStorage.getItem(LS_WEEK_START) as WeekStartDay | null;
      const prefix   = localStorage.getItem(LS_SHARE_PREFIX);
      setDietaryDefault(dietary);
      setDefaultServings(servings ? Math.max(1, Math.min(12, parseInt(servings, 10))) : 2);
      if (weekDay && ["monday","sunday","saturday"].includes(weekDay)) setWeekStartDay(weekDay);
      if (prefix !== null) setSharePrefix(prefix);
    } catch {}
    setPrefsLoaded(true);
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error ?? "Could not open billing portal. Please try again.");
      }
    } catch {
      setPortalError("Something went wrong. Please try again.");
    }
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

  async function loadAlexaStatus() {
    try {
      const res = await fetch("/api/alexa/skill-status");
      if (!res.ok) return;
      const data = await res.json();
      setAlexaLinked(data.linked ?? false);
    } catch { /* silent */ }
  }

  async function loadGoogleStatus() {
    try {
      const res = await fetch("/api/google/status");
      if (!res.ok) return;
      const data = await res.json();
      setGoogleConnected(data.connected ?? false);
    } catch { /* silent */ }
  }

  async function disconnectGoogle() {
    setGoogleDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "DELETE" });
      setGoogleConnected(false);
    } finally {
      setGoogleDisconnecting(false);
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

  function saveSharePrefix(value: string) {
    const trimmed = value.trim() || DEFAULT_SHARE_PREFIX;
    setSharePrefix(trimmed);
    try { localStorage.setItem(LS_SHARE_PREFIX, trimmed); } catch {}
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

          {installState === "android" && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">Add to your home screen</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Install in seconds — no Play Store needed.
                </p>
              </div>
              <ol className="space-y-3">
                {[
                  { n: 1, icon: "⋮", text: <>Tap the <strong className="text-foreground">three-dot menu</strong> (⋮) in the top-right corner of Chrome</> },
                  { n: 2, icon: "📲", text: <>Tap <strong className="text-foreground">Add to Home screen</strong></> },
                  { n: 3, icon: "✅", text: <>Tap <strong className="text-foreground">Add</strong> to confirm</> },
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

          {(installState === "other" || installState === "loading") && (
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">📱</span>
                <div>
                  <p className="text-sm font-medium text-foreground">Install on your device</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    <strong className="text-foreground">iPhone:</strong> Open in Safari → tap Share ⬆️ → <strong className="text-foreground">Add to Home Screen</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    <strong className="text-foreground">Android:</strong> Open in Chrome → tap ⋮ → <strong className="text-foreground">Add to Home Screen</strong>
                  </p>
                </div>
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
          <Row>
            <div>
              <p className="text-sm font-medium text-foreground">Default dietary filter</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-applied when you open Recipes
              </p>
            </div>
            {prefsLoaded ? (
              <select
                value={dietaryDefault}
                onChange={(e) => saveDietary(e.target.value)}
                className="shrink-0 text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/30 cursor-pointer"
              >
                {DIETARY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : (
              <div className="h-9 w-32 bg-secondary rounded-lg animate-pulse shrink-0" />
            )}
          </Row>

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

          <Divider />

          {/* Share list prefix */}
          <div className="px-5 py-4 space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">Share list prefix</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The opening line when you copy or share your grocery list
              </p>
            </div>
            {prefsLoaded ? (
              <input
                type="text"
                value={sharePrefix}
                onChange={(e) => setSharePrefix(e.target.value)}
                onBlur={(e) => saveSharePrefix(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSharePrefix((e.target as HTMLInputElement).value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                placeholder={DEFAULT_SHARE_PREFIX}
              />
            ) : (
              <div className="h-9 w-full bg-secondary rounded-lg animate-pulse" />
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

          {portalError && (
            <>
              <Divider />
              <div className="px-5 py-3">
                <p className="text-xs text-red-400">{portalError}</p>
              </div>
            </>
          )}

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

      {/* ── Alexa ───────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<List className="w-3.5 h-3.5" />} title="Amazon Alexa" />
        <Card>
          {/* Link status row */}
          <Row>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                alexaLinked ? "bg-green-500/15" : "bg-secondary",
              )}>
                {alexaLinked
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <List className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {alexaLinked === null ? "Checking…" : alexaLinked ? "Skill linked" : "Skill not linked"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alexaLinked
                    ? "Voice-control your pantry hands-free"
                    : "Enable the Maui’s Kitchen skill in the Alexa app to connect"}
                </p>
              </div>
            </div>
          </Row>

          {/* Voice commands — only shown when linked */}
          {alexaLinked && (
            <>
              <Divider />
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-foreground">Voice commands</p>
                <div className="space-y-2">
                  {[
                    { label: "Remove items from pantry", example: "\"Alexa, tell Maui’s Kitchen I bought milk and eggs\"" },
                    { label: "Add items to pantry",      example: "\"Alexa, tell Maui’s Kitchen I have butter and cheese\"" },
                    { label: "One-shot (no wake phrase)", example: "\"Alexa, ask Maui’s Kitchen I bought salmon\"" },
                  ].map(({ label, example }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xs text-foreground italic mt-0.5">{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Setup instructions — only shown when not yet linked */}
          {alexaLinked === false && (
            <>
              <Divider />
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-foreground">How to connect</p>
                <ol className="space-y-2">
                  {[
                    "Open the Alexa app on your phone",
                    <>Go to <strong className="text-foreground">More → Skills &amp; Games</strong></>,
                    <>Search for <strong className="text-foreground">Maui&apos;s Kitchen</strong> and tap Enable</>,
                    <>Tap <strong className="text-foreground">Link Account</strong> and sign in to Maui&apos;s Kitchen</>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground pt-1">
                  Once linked, say{" "}
                  <span className="font-medium text-foreground italic">&ldquo;Alexa, tell Maui&apos;s Kitchen I bought milk&rdquo;</span>
                  {" "}to remove items from your pantry by voice.
                </p>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ── Google Tasks ────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Settings2 className="w-3.5 h-3.5" />} title="Google Tasks" />
        <Card>
          <Row>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                googleConnected ? "bg-green-500/15" : "bg-secondary",
              )}>
                {googleConnected
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.09 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {googleConnected === null ? "Checking…" : googleConnected ? "Google connected" : "Google not connected"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {googleConnected
                    ? "Sync your grocery list to Google Tasks"
                    : "Connect to push your grocery list as individual tasks"}
                </p>
              </div>
            </div>
            {googleConnected === false && (
              <a
                href="/api/google/auth"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-secondary transition-colors shrink-0 whitespace-nowrap"
              >
                Connect
                <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </Row>

          {googleConnected && (
            <>
              <Divider />
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-foreground">How it works</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tap <span className="font-medium text-foreground">Share List → Sync to Google Tasks</span> on the Grocery List page.
                  Items are added to a <span className="font-medium text-foreground">&ldquo;Maui&apos;s Kitchen&rdquo;</span> task list in your Google account.
                  Then say: <span className="font-medium text-foreground italic">&ldquo;Hey Google, show my Maui&apos;s Kitchen tasks&rdquo;</span>
                </p>
                <button
                  onClick={disconnectGoogle}
                  disabled={googleDisconnecting}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 bg-red-400/5 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {googleDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Disconnect Google
                </button>
              </div>
            </>
          )}

          {googleConnected === false && (
            <>
              <Divider />
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-medium text-foreground">How to connect</p>
                <ol className="space-y-2">
                  {[
                    <>Tap <strong className="text-foreground">Connect</strong> above and sign in with Google</>,
                    <>Approve access to <strong className="text-foreground">Google Tasks</strong></>,
                    <>On the Grocery List page, tap <strong className="text-foreground">Share List → Sync to Google Tasks</strong></>,
                    <>Say: <span className="italic text-foreground">&ldquo;Hey Google, show my Maui&apos;s Kitchen tasks&rdquo;</span></>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* ── Apple Reminders ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Settings2 className="w-3.5 h-3.5" />} title="Apple Reminders" />
        <Card>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FF3B30]/10 flex items-center justify-center shrink-0">
                <span className="text-lg">🔔</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Siri &amp; Apple Reminders</p>
                <p className="text-xs text-muted-foreground mt-0.5">Share your grocery list directly to the Reminders app</p>
              </div>
            </div>
          </Row>
          <Divider />
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs font-medium text-foreground">How to use on iPhone / iPad</p>
            <ol className="space-y-2">
              {[
                <>Open the <strong className="text-foreground">Grocery List</strong> page</>,
                <>Tap <strong className="text-foreground">Share List</strong> → <strong className="text-foreground">Add to Reminders</strong></>,
                <>Your list is added as a reminder — say <span className="italic text-foreground">&ldquo;Hey Siri, show my reminders&rdquo;</span></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-brand-orange/15 text-brand-orange text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Apple does not offer a direct API for Reminders from web apps — the native iOS share sheet is the only supported method.
            </p>
          </div>
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
