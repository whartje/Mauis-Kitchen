import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// Stripe requires the raw body for signature verification
export const dynamic = "force-dynamic";

function mapStatus(
  status: Stripe.Subscription.Status,
): "ACTIVE" | "CANCELED" | "PAST_DUE" | "TRIALING" {
  switch (status) {
    case "active":   return "ACTIVE";
    case "trialing": return "TRIALING";
    case "past_due": return "PAST_DUE";
    default:         return "CANCELED";
  }
}

/**
 * In Stripe API 2026-04-22.dahlia, current_period_end moved from Subscription
 * to SubscriptionItem.  Helper to read it from whichever location it exists.
 */
function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  // New location: items.data[0].current_period_end
  const item = subscription.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const ts = item?.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId =
    subscription.metadata?.userId ??
    // fallback: look up by customer ID
    (await prisma.userSubscription.findUnique({
      where: { stripeCustomerId: subscription.customer as string },
      select: { userId: true },
    }))?.userId;

  if (!userId) {
    console.warn("syncSubscription: no userId found for subscription", subscription.id);
    return;
  }

  const isActive = subscription.status === "active" || subscription.status === "trialing";

  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId:     subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId:        subscription.items.data[0]?.price?.id ?? null,
      plan:                 isActive ? "PRO" : "FREE",
      status:               mapStatus(subscription.status),
      currentPeriodEnd:     getPeriodEnd(subscription),
    },
    update: {
      stripeCustomerId:     subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId:        subscription.items.data[0]?.price?.id ?? null,
      plan:                 isActive ? "PRO" : "FREE",
      status:               mapStatus(subscription.status),
      currentPeriodEnd:     getPeriodEnd(subscription),
    },
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature failed:", err);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] },
        );
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.userSubscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan:                 "FREE",
            status:               "CANCELED",
            stripeSubscriptionId: null,
            stripePriceId:        null,
            currentPeriodEnd:     null,
          },
        });
        break;
      }

      // Invoice parent.subscription_details is the new location in API 2026-04-22
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Try new API location first, fall back to legacy field
        const subId =
          (invoice as { parent?: { subscription_details?: { subscription?: string } } })
            .parent?.subscription_details?.subscription;
        if (!subId) break;
        await prisma.userSubscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: "PAST_DUE" },
        });
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
