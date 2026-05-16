import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state"); // must match the authenticated user's ID
  const error = searchParams.get("error");

  const appUrl = getAppUrl();

  // Validate the authenticated session — the callback is browser-initiated so
  // Clerk's session cookie is present. Reject if there is no active session.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/sign-in`);
  }

  // Reject if the state param is missing or does not match the session user.
  // This prevents CSRF / account-takeover via a crafted OAuth callback URL.
  if (error || !code || !state || state !== userId) {
    return NextResponse.redirect(`${appUrl}/settings?tab=integrations&google=error`);
  }

  const redirectUri = `${appUrl}/api/google/callback`;

  // Exchange authorisation code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/settings?tab=integrations&google=error`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      `${appUrl}/settings?tab=integrations&google=no_refresh_token`
    );
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.googleCredential.upsert({
    where:  { userId },
    update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt, tasksListId: null },
    create: { userId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt },
  });

  return NextResponse.redirect(`${appUrl}/settings?tab=integrations&google=connected`);
}
