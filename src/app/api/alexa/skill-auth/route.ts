import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Alexa account-linking redirects to this endpoint.
// The user must be logged in to Maui's Kitchen; we generate an auth code
// and send it back to Alexa's redirect_uri.

const AMAZON_REDIRECT_HOSTS = [
  "layla.amazon.com",
  "pitangui.amazon.com",
  "alexa.amazon.co.jp",
  "alexa.amazon.com",
];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const redirectUri = sp.get("redirect_uri");
  const state = sp.get("state");
  const responseType = sp.get("response_type");

  if (!redirectUri || !state || responseType !== "code") {
    return NextResponse.json({ error: "Invalid account-linking request" }, { status: 400 });
  }

  // Only allow Amazon's own redirect URIs
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    return NextResponse.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  if (!AMAZON_REDIRECT_HOSTS.some((h) => parsedRedirect.hostname === h)) {
    return NextResponse.json({ error: "Disallowed redirect_uri" }, { status: 400 });
  }

  // Require the user to be signed in
  const { userId } = await auth();
  if (!userId) {
    // Redirect to sign-in; after auth Clerk will send them back here
    const returnUrl = req.url;
    return NextResponse.redirect(
      new URL(
        `/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`,
        process.env.NEXT_PUBLIC_APP_URL ?? req.url
      )
    );
  }

  // Generate a short-lived auth code
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clean up any previous codes for this user
  await prisma.alexaAuthCode.deleteMany({ where: { userId } });

  // Store the new code
  await prisma.alexaAuthCode.create({ data: { code, userId, expiresAt } });

  // Send the user back to Alexa
  parsedRedirect.searchParams.set("code", code);
  parsedRedirect.searchParams.set("state", state);

  return NextResponse.redirect(parsedRedirect.toString());
}
