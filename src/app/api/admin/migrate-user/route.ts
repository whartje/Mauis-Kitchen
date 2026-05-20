/**
 * TEMPORARY one-time migration route — DELETE after use.
 * Reassigns all data from old dev Clerk user ID → new prod Clerk user ID.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const OLD_USER_ID = "user_3BjqbysmfWOp6k0q3TNF7HV61Ds";
const NEW_USER_ID = "user_3DyPxH8J2ADWdpNy1j3yDUuSlrh";
const SECRET = "mk-migrate-2026";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [recipes, mealPlans, groceryLists, pantryItems, subscriptions, googleCreds, alexaCreds, alexaLinks, feedback] =
    await Promise.all([
      prisma.recipe.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.mealPlan.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.groceryList.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.pantryItem.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.userSubscription.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.googleCredential.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.alexaCredential.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.alexaSkillLink.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
      prisma.feedback.updateMany({ where: { userId: OLD_USER_ID }, data: { userId: NEW_USER_ID } }),
    ]);

  return NextResponse.json({
    success: true,
    migrated: { recipes: recipes.count, mealPlans: mealPlans.count, groceryLists: groceryLists.count, pantryItems: pantryItems.count, subscriptions: subscriptions.count, googleCreds: googleCreds.count, alexaCreds: alexaCreds.count, alexaLinks: alexaLinks.count, feedback: feedback.count },
  });
}
