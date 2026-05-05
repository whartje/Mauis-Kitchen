import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const PutSchema = z.object({
  steps: z.array(z.object({ text: z.string() })),
});

/** PUT /api/recipes/[id]/instructions — replace all instructions */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: recipeId } = await params;

  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await request.json();
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { steps } = parsed.data;

  // Delete all existing instructions then recreate in order, atomically
  const instructions = await prisma.$transaction(async (tx) => {
    await tx.instruction.deleteMany({ where: { recipeId } });

    const created = await Promise.all(
      steps.map((step, i) =>
        tx.instruction.create({
          data: { recipeId, stepNumber: i + 1, text: step.text.trim() },
        })
      )
    );

    return created.sort((a, b) => a.stepNumber - b.stepNumber);
  });

  return NextResponse.json({ instructions });
}
