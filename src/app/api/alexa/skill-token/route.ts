import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Alexa calls this to exchange the auth code for an access token.
// We act as the OAuth 2.0 authorization server.

export async function POST(req: NextRequest) {
  // Parse body — Alexa sends application/x-www-form-urlencoded
  const contentType = req.headers.get("content-type") ?? "";
  let params: Record<string, string>;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    params = Object.fromEntries(new URLSearchParams(text).entries());
  } else {
    params = (await req.json()) as Record<string, string>;
  }

  // Client credentials may also arrive via HTTP Basic auth
  let clientId = params.client_id;
  let clientSecret = params.client_secret;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const [id, secret] = decoded.split(":");
    clientId = clientId ?? id;
    clientSecret = clientSecret ?? secret;
  }

  // Verify our own client credentials (we defined these when setting up account linking)
  if (
    clientId !== process.env.ALEXA_SKILL_CLIENT_ID ||
    clientSecret !== process.env.ALEXA_SKILL_CLIENT_SECRET
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  const { grant_type, code } = params;

  if (grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  // Look up and validate the auth code
  const authCode = await prisma.alexaAuthCode.findUnique({ where: { code } });

  if (!authCode || authCode.expiresAt < new Date()) {
    if (authCode) await prisma.alexaAuthCode.delete({ where: { code } });
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  // Single-use — delete it immediately
  await prisma.alexaAuthCode.delete({ where: { code } });

  // Issue a long-lived access token
  const accessToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // ~10 years

  await prisma.alexaSkillLink.upsert({
    where: { userId: authCode.userId },
    create: { userId: authCode.userId, accessToken, expiresAt },
    update: { accessToken, expiresAt },
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 10 * 365 * 24 * 3600,
  });
}
