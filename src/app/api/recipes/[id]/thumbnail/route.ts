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

// ── POST: upload a new photo, add to gallery, make it the primary ─────────────
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
  const filename = `${userId}/${id}-photo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("recipe-images")
    .upload(filename, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Photo upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(filename);
  const imageUrl = urlData.publicUrl;

  // Build the updated gallery: preserve existing photos, add the new one
  const existing = recipe.imageGallery as string[];
  let gallery = [...existing];

  // If recipe had a legacy imageUrl not yet in gallery, include it first
  if (recipe.imageUrl && !gallery.includes(recipe.imageUrl)) {
    gallery = [recipe.imageUrl, ...gallery];
  }

  // Add the newly uploaded photo (avoid duplicates)
  if (!gallery.includes(imageUrl)) {
    gallery.push(imageUrl);
  }

  await prisma.recipe.update({
    where: { id },
    data: { imageUrl, imageGallery: gallery },
  });

  return NextResponse.json({ imageUrl, gallery });
}

// ── PATCH: set an existing gallery photo as the primary (no re-upload) ────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { imageUrl } = await request.json() as { imageUrl?: string };
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  const recipe = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gallery = recipe.imageGallery as string[];
  if (!gallery.includes(imageUrl)) {
    return NextResponse.json({ error: "Image not in gallery" }, { status: 400 });
  }

  await prisma.recipe.update({ where: { id }, data: { imageUrl } });

  return NextResponse.json({ imageUrl });
}
