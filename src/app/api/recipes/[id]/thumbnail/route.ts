import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: "Only JPEG, PNG, and WEBP are supported" }, { status: 400 });
  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.split("/")[1] ?? "jpg";
  const filename = `${userId}/${id}-thumbnail-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("recipe-images")
    .upload(filename, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Thumbnail upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(filename);
  const imageUrl = urlData.publicUrl;

  await prisma.recipe.update({ where: { id }, data: { imageUrl } });

  return NextResponse.json({ imageUrl });
}
