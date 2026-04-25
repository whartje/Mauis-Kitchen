export const maxDuration = 60; // Vercel Hobby plan max

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRecipeFromImage } from "@/lib/claude";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "No file provided" } }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Only JPEG, PNG, and WEBP images are supported" } },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Image must be under 10MB" } },
      { status: 400 }
    );
  }

  const collection = formData.get("collection") as string | null;

  // Read all files (support multi-page recipes)
  const allFiles = formData.getAll("file") as File[];
  const files = allFiles.length > 0 ? allFiles : [file];

  // Validate each file
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type as AllowedType)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Only JPEG, PNG, and WEBP images are supported" } },
        { status: 400 }
      );
    }
    if (f.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Each image must be under 10MB" } },
        { status: 400 }
      );
    }
  }

  // Convert all files to buffers
  const buffers = await Promise.all(
    files.map(async (f) => ({ buffer: Buffer.from(await f.arrayBuffer()), type: f.type as AllowedType }))
  );

  // Analyze with Claude Vision (pass buffers directly)
  let result;
  try {
    result = await normalizeRecipeFromImage(buffers);
  } catch (err) {
    console.error("Claude Vision error:", err);
    return NextResponse.json(
      { error: { code: "AI_ERROR", message: "Could not read a recipe from this image." } },
      { status: 422 }
    );
  }

  // Use collage thumbnail if provided, otherwise fall back to first file
  const thumbnailFile = formData.get("thumbnail") as File | null;
  const uploadFile = thumbnailFile ?? files[0];
  const uploadBuffer = thumbnailFile
    ? Buffer.from(await thumbnailFile.arrayBuffer())
    : buffers[0].buffer;
  const filename = `${userId}/${Date.now()}-${uploadFile.name || "recipe.jpg"}`;
  const { error: uploadError } = await supabase.storage
    .from("recipe-images")
    .upload(filename, uploadBuffer, { contentType: uploadFile.type });

  // Non-fatal — recipe saves without thumbnail if upload fails
  const imageUrl = uploadError
    ? null
    : supabase.storage.from("recipe-images").getPublicUrl(filename).data.publicUrl;

  // Multiple recipes found — ask user to choose
  // The select route needs the imageUrl to re-analyze, so require a successful upload here
  if (result.multipleRecipes) {
    if (!imageUrl) {
      return NextResponse.json(
        { error: { code: "UPLOAD_FAILED", message: "Could not store the image. Please try again." } },
        { status: 500 }
      );
    }
    return NextResponse.json({ multipleRecipes: true, titles: result.titles, imageUrl });
  }

  // Single recipe — save it
  const { recipe } = result;

  const saved = await prisma.recipe.create({
    data: {
      userId,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      difficulty: recipe.difficulty,
      tags: recipe.tags,
      imageUrl,
      collection: collection ?? undefined,
      ingredients: {
        create: recipe.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          raw: ing.raw,
          notes: ing.notes,
          category: ing.category,
          sortOrder: idx,
        })),
      },
      instructions: {
        create: recipe.instructions.map((step) => ({
          stepNumber: step.stepNumber,
          text: step.text,
        })),
      },
      ...(recipe.nutrition && {
        nutrition: {
          create: {
            calories: recipe.nutrition.calories,
            protein: recipe.nutrition.protein,
            carbs: recipe.nutrition.carbs,
            fat: recipe.nutrition.fat,
            fiber: recipe.nutrition.fiber,
            sugar: recipe.nutrition.sugar,
            sodium: recipe.nutrition.sodium,
            servingSize: recipe.nutrition.servingSize,
          },
        },
      }),
    },
    include: {
      ingredients: { orderBy: { sortOrder: "asc" } },
      instructions: { orderBy: { stepNumber: "asc" } },
      nutrition: true,
    },
  });

  return NextResponse.json(saved, { status: 201 });
}
