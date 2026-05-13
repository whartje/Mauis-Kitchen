-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on server-only tables
--
-- These three tables are accessed exclusively through Prisma using the
-- Supabase service-role key, which bypasses RLS. Enabling RLS with no
-- permissive policies means the anon / authenticated Supabase keys can never
-- read or write these tables directly — only the backend can.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlexaAuthCode: short-lived codes used during Alexa account-linking OAuth flow
ALTER TABLE "AlexaAuthCode" ENABLE ROW LEVEL SECURITY;

-- AlexaSkillLink: maps Clerk userIds to Alexa skill access tokens
ALTER TABLE "AlexaSkillLink" ENABLE ROW LEVEL SECURITY;

-- UserSubscription: Stripe subscription data per user
ALTER TABLE "UserSubscription" ENABLE ROW LEVEL SECURITY;
