import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, PRICE_IDS, APP_URL } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  interval: z.enum(["month", "year"]),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid interval" }, { status: 400 });

  const priceId =
    parsed.data.interval === "month" ? PRICE_IDS.PRO_MONTHLY : PRICE_IDS.PRO_ANNUAL;

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price IDs are not configured. Set STRIPE_PRO_MONTHLY_PRICE_ID and STRIPE_PRO_ANNUAL_PRICE_ID." },
      { status: 500 },
    );
  }

  // Get or create Stripe customer ID
  let sub = await prisma.userSubscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId ?? null;

  if (!customerId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;

    await prisma.userSubscription.upsert({
      where: { userId },
      create: { userId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true, // founding-member promo codes are entered here
    success_url: `${APP_URL}/settings?tab=billing&upgraded=true`,
    cancel_url:  `${APP_URL}/pricing`,
    subscription_data: {
      metadata: { userId },
    },
  });

  return NextResponse.json({ url: session.url });
}
