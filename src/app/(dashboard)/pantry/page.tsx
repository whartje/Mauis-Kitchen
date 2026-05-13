import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { PantryClient } from "@/components/pantry/pantry-client";

export default async function PantryPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [rawItems, alexaLink] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, orderBy: { addedAt: "asc" } }),
    prisma.alexaSkillLink.findUnique({ where: { userId }, select: { userId: true } }),
  ]);

  // Serialise Date → ISO string so the client component receives a plain object
  const items = rawItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    raw: item.raw,
    category: item.category,
    expiresAt: item.expiresAt?.toISOString() ?? null,
  }));

  return <PantryClient initialItems={items} alexaSkillLinked={!!alexaLink} />;
}
