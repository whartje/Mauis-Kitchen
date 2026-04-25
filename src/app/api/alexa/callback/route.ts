import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/grocery-list?alexa_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/grocery-list?alexa_error=missing_params", req.url));
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("alexa_oauth_state")?.value;
  cookieStore.delete("alexa_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL("/grocery-list?alexa_error=invalid_state", req.url));
  }

  const clientId = process.env.AMAZON_CLIENT_ID!;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/alexa/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Amazon token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/grocery-list?alexa_error=token_exchange", req.url));
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.alexaCredential.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      listId: null, // Clear cached list ID on reconnect
    },
  });

  return NextResponse.redirect(new URL("/grocery-list?alexa_connected=1", req.url));
}
