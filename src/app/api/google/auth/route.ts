import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const SCOPES = ["https://www.googleapis.com/auth/tasks"].join(" ");

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const redirectUri = `${appUrl}/api/google/callback`;

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",          // always request refresh token
    state:         userId,             // carry userId through the flow
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
