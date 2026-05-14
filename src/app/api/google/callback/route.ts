import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code    = searchParams.get("code");
  const userId  = searchParams.get("state");  // passed through from /auth
  const error   = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (error || !code || !userId) {
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
    // This can happen if the user already granted access; revoke and retry
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
