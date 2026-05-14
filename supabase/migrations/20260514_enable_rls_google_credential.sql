-- Enable RLS on GoogleCredential — server-only table accessed exclusively
-- via Prisma with the service-role key (which bypasses RLS). No permissive
-- policies means anon/authenticated Supabase keys can never access it directly.
ALTER TABLE "GoogleCredential" ENABLE ROW LEVEL SECURITY;
