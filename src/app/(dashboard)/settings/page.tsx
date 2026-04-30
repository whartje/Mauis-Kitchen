import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const alexa = await prisma.alexaCredential.findUnique({
    where: { userId },
    select: { expiresAt: true },
  });

  const alexaConnected = alexa != null;

  return <SettingsClient alexaConnected={alexaConnected} />;
}
