import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { PantryClient } from "@/components/pantry/pantry-client";

export default async function PantryPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const items = await prisma.pantryItem.findMany({
    where: { userId },
    orderBy: { addedAt: "asc" },
  });

  return <PantryClient initialItems={items} />;
}
