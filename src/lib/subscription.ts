import { prisma } from "./prisma";

// ── Tier limits ───────────────────────────────────────────────────────────────
export const FREE_RECIPE_LIMIT = 30;
export const FREE_PHOTO_LIMIT  = 5;
export const PRO_PHOTO_LIMIT   = 30;

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserPlan = "FREE" | "PRO";

export interface SubSummary {
  plan: UserPlan;
  isPro: boolean;
  currentPeriodEnd: Date | null;
  photoImportsThisMonth: number;
  photoImportResetAt: Date;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Fetch subscription summary; returns FREE defaults if no record exists. */
export async function getSubSummary(userId: string): Promise<SubSummary> {
  const sub = await prisma.userSubscription.findUnique({ where: { userId } });
  const plan = (sub?.plan ?? "FREE") as UserPlan;
  const status = sub?.status ?? "ACTIVE";
  const isProStatus = plan === "PRO" && (status === "ACTIVE" || status === "TRIALING");
  return {
    plan,
    isPro: isProStatus,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    photoImportsThisMonth: sub?.photoImportsThisMonth ?? 0,
    photoImportResetAt: sub?.photoImportResetAt ?? new Date(),
  };
}

/** Ensure a subscription row exists for tracking (no Stripe ID needed for free users). */
async function ensureSub(userId: string) {
  return prisma.userSubscription.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

// ── Limit checks ──────────────────────────────────────────────────────────────

export async function checkRecipeLimit(
  userId: string,
): Promise<{ allowed: boolean; count: number; limit: number | null }> {
  const sub = await getSubSummary(userId);
  if (sub.isPro) return { allowed: true, count: 0, limit: null };

  const count = await prisma.recipe.count({ where: { userId } });
  return { allowed: count < FREE_RECIPE_LIMIT, count, limit: FREE_RECIPE_LIMIT };
}

/**
 * Check whether a photo import is allowed for this user.
 * Does NOT increment the counter — call incrementPhotoImport() after a
 * successful Claude Vision response.
 */
export async function checkPhotoLimit(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const sub = await getSubSummary(userId);
  const limit = sub.isPro ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT;

  const record = await ensureSub(userId);

  // Reset counter if we've rolled into a new calendar month
  const now = new Date();
  const resetAt = record.photoImportResetAt;
  if (
    now.getUTCFullYear() !== resetAt.getUTCFullYear() ||
    now.getUTCMonth() !== resetAt.getUTCMonth()
  ) {
    await prisma.userSubscription.update({
      where: { userId },
      data: { photoImportsThisMonth: 0, photoImportResetAt: now },
    });
    return { allowed: true, used: 0, limit };
  }

  return {
    allowed: record.photoImportsThisMonth < limit,
    used: record.photoImportsThisMonth,
    limit,
  };
}

/** Call after a successful photo import to increment the monthly counter. */
export async function incrementPhotoImport(userId: string): Promise<void> {
  await prisma.userSubscription.update({
    where: { userId },
    data: { photoImportsThisMonth: { increment: 1 } },
  });
}
