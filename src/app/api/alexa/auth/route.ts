import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const SCOPES = "alexa::household:lists:read alexa::household:lists:write";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.AMAZON_CLIENT_ID;
  if (!clientId) {
    // Redirect back to grocery list with a friendly error instead of raw JSON
    return NextResponse.redirect(
      new URL("/grocery-list?alexa_error=not_configured", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie for CSRF verification
  const cookieStore = await cookies();
  cookieStore.set("alexa_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 min
    path: "/",
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/alexa/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });

  return NextResponse.redirect(`https://www.amazon.com/ap/oa?${params}`);
}
