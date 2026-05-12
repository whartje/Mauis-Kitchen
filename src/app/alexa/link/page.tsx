// This page is the account-linking landing point for the Maui's Kitchen Alexa skill.
// Clerk middleware protects it — unauthenticated users are sent to /sign-in and
// redirected back here (with the full URL + query params) after they log in.
// Once authenticated we generate a short-lived auth code and send it back to Amazon.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Amazon's Alexa account-linking callback domains
const AMAZON_REDIRECT_HOSTS = [
  "layla.amazon.com",
  "pitangui.amazon.com",
  "alexa.amazon.co.jp",
  "alexa.amazon.com",
];

interface Props {
  searchParams: Promise<{
    redirect_uri?: string;
    state?: string;
    response_type?: string;
  }>;
}

export default async function AlexaLinkPage({ searchParams }: Props) {
  const sp = await searchParams;
  const redirectUri = sp.redirect_uri;
  const state = sp.state;

  // ── Parameter validation ────────────────────────────────────────────────────
  if (!redirectUri || !state) {
    return (
      <ErrorPage message="Invalid account-linking request — required parameters are missing." />
    );
  }

  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return <ErrorPage message="Invalid redirect URI." />;
  }

  if (!AMAZON_REDIRECT_HOSTS.some((h) => parsedRedirect.hostname === h)) {
    return <ErrorPage message="Disallowed redirect destination." />;
  }

  // ── Auth check ───────────────────────────────────────────────────────────────
  // Clerk middleware ensures the user is signed in before reaching here.
  // The !userId branch is a safety fallback only.
  const { userId } = await auth();
  if (!userId) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(
        `/alexa/link?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&response_type=code`
      )}`
    );
  }

  // ── Generate auth code ───────────────────────────────────────────────────────
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute window

  // Replace any existing code for this user (one active code at a time)
  await prisma.alexaAuthCode.deleteMany({ where: { userId } });
  await prisma.alexaAuthCode.create({ data: { code, userId, expiresAt } });

  // ── Send user back to Amazon ─────────────────────────────────────────────────
  parsedRedirect.searchParams.set("code", code);
  parsedRedirect.searchParams.set("state", state);

  redirect(parsedRedirect.toString());
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-sm w-full space-y-3 text-center">
        <p className="text-2xl">⚠️</p>
        <p className="text-sm font-medium text-foreground">Account linking failed</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
