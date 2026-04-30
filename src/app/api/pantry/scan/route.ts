import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { identifyPantryIngredientsFromBuffer } from "@/lib/claude";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = typeof ALLOWED_TYPES[number];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type as AllowedType))
    return NextResponse.json({ error: "Only JPEG, PNG, and WebP are supported" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Image must be under 20 MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ingredients = await identifyPantryIngredientsFromBuffer(
    buffer,
    file.type as AllowedType
  );

  // Sort by confidence descending, filter to ≥ 0.5
  const results = ingredients
    .filter((i) => i.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({ ingredients: results });
}
