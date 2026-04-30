"use client";

import { useState, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Sun, Moon, LogOut, Wifi, WifiOff, Settings2, Users,
  Loader2, Check, ChevronRight, ExternalLink,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

// ── Local-storage keys ────────────────────────────────────────────────────────
const LS_DIETARY  = "mauisKitchen_dietaryDefault";
const LS_SERVINGS = "mauisKitchen_defaultServings";

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

interface Props {
  alexaConnected: boolean;
}

export function SettingsClient({ alexaConnected: initialAlexaConnected }: Props) {
  const { theme, setTheme, mounted } = useTheme();
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  // Preferences — hydrated from localStorage after mount
  const [dietaryDefault, setDietaryDefault] = useState("");
  const [defaultServings, setDefaultServings] = useState(2);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Alexa
  const [alexaConnected, setAlexaConnected] = useState(initialAlexaConnected);
  const [alexaDisconnecting, setAlexaDisconnecting] = useState(false);

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const dietary  = localStorage.getItem(LS_DIETARY)  ?? "";
      const servings = localStorage.getItem(LS_SERVINGS);
      setDietaryDefault(dietary);
      setDefaultServings(servings ? Math.max(1, Math.min(12, parseInt(servings, 10))) : 2);
    } catch {}
    setPrefsLoaded(true);
  }, []);

  function saveDietary(value: string) {
    setDietaryDefault(value);
    try { localStorage.setItem(LS_DIETARY, value); } catch {}
  }

  function saveServings(value: number) {
    const clamped = Math.max(1, Math.min(12, value));
    setDefaultServings(clamped);
    try { localStorage.setItem(LS_SERVINGS, String(clamped)); } catch {}
  }

  async function disconnectAlexa() {
    setAlexaDisconnecting(true);
    try {
      const res = await fetch("/api/alexa/disconnect", { method: "DELETE" });
      if (res.ok) setAlexaConnected(false);
    } finally {
      setAlexaDisconnecting(false);
    }
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Personalise Maui&apos;s Kitchen</p>
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
        </Card>
      </section>

      {/* ── Alexa Integration ───────────────────────────────────────────────── */}
      <section className="space-y-2">
        <SectionLabel icon={<Wifi className="w-3.5 h-3.5" />} title="Alexa Integration" />
        <Card>
          <div className="px-5 py-4 space-y-4">
            {/* Status + connect/disconnect */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  alexaConnected ? "bg-green-400/15" : "bg-secondary"
                )}>
                  {alexaConnected
                    ? <Wifi className="w-5 h-5 text-green-400" />
                    : <WifiOff className="w-5 h-5 text-muted-foreground" />
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {alexaConnected ? "Amazon account connected" : "Not connected"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                    {alexaConnected
                      ? "Grocery lists can be sent directly to your Alexa Shopping List"
                      : "Link your Amazon account to add grocery items by voice"
                    }
                  </p>
                </div>
              </div>

              {alexaConnected ? (
                <button
                  onClick={disconnectAlexa}
                  disabled={alexaDisconnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                >
                  {alexaDisconnecting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <WifiOff className="w-3.5 h-3.5" />
                  }
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/alexa/auth"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00CAFF]/10 border border-[#00CAFF]/30 text-[#00CAFF] hover:bg-[#00CAFF]/20 text-sm font-medium transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect with Amazon
                </a>
              )}
            </div>

            {/* How it works */}
            <div className="bg-secondary/50 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How it works</p>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                <li>Connect your Amazon account above</li>
                <li>Open <strong className="text-foreground">Grocery List</strong> and tap <strong className="text-foreground">Send to Alexa</strong></li>
                <li>Ask Alexa: &ldquo;What&apos;s on my shopping list?&rdquo;</li>
              </ol>
            </div>
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
