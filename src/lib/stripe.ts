import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

/**
 * Create these two prices in your Stripe Dashboard → Products, then set the
 * env vars below in .env.local and on Vercel.
 *
 * Product:  Maui's Kitchen Pro
 *   Price 1: $3.99 / month   → STRIPE_PRO_MONTHLY_PRICE_ID
 *   Price 2: $34.99 / year   → STRIPE_PRO_ANNUAL_PRICE_ID
 */
export const PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
  PRO_ANNUAL:  process.env.STRIPE_PRO_ANNUAL_PRICE_ID  ?? "",
} as const;

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
