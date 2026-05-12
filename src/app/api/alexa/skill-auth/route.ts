import { NextRequest, NextResponse } from "next/server";

// This API route is the Authorization URI registered in the Alexa Developer Console.
// It immediately redirects to the /alexa/link page which is a proper Clerk-protected
// Next.js page — Clerk middleware handles sign-in and redirects the user back here
// with the full URL including all OAuth params intact.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const redirectUri = sp.get("redirect_uri");
  const state = sp.get("state");

  if (!redirectUri || !state) {
    return NextResponse.json(
      { error: "Missing required OAuth parameters (redirect_uri, state)" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const pageUrl = new URL("/alexa/link", appUrl);
  pageUrl.searchParams.set("redirect_uri", redirectUri);
  pageUrl.searchParams.set("state", state);
  pageUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(pageUrl.toString());
}
