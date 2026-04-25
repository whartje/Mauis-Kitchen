import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { IngredientCategory } from "@prisma/client";

const CATEGORY_ORDER: IngredientCategory[] = [
  "PRODUCE",
  "PROTEIN",
  "DAIRY",
  "GRAINS",
  "PANTRY",
  "SPICES",
  "FROZEN",
  "BEVERAGES",
  "OTHER",
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await prisma.groceryList.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ list });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { weekStart } = body as { weekStart: string };

  const weekStartDate = new Date(weekStart);

  const mealPlan = await prisma.mealPlan.findFirst({
    where: {
      userId,
      weekStartDate: weekStartDate,
    },
    include: {
      items: {
        include: {
          recipe: {
            include: {
              ingredients: true,
            },
          },
        },
      },
    },
  });

  if (!mealPlan) {
    return NextResponse.json(
      { error: "No meal plan found for this week" },
      { status: 404 }
    );
  }

  // Clean ingredient names that accidentally include quantity/unit text
  // e.g. "g / 3.5 oz chickpea flour" → "chickpea flour"
  // e.g. "/ 10 tbsp soy milk" → "soy milk"
  function cleanIngredientName(raw: string): string {
    const units = "ml|l|g|kg|oz|lb|cup|cups|tbsp|tsp|teaspoon|tablespoon|pint|quart|gallon|fl oz";
    const cleaned = raw
      // "100g / 3.5 oz name" or "100 g / 3.5 oz name"
      .replace(new RegExp(`^[\\d.]+\\s*(${units})\\s*\\/\\s*[\\d.]+\\s*(${units})\\s+`, "i"), "")
      // "g / 3.5 oz name" (missing leading number)
      .replace(new RegExp(`^(${units})\\s*\\/\\s*[\\d.]+\\s*(${units})\\s+`, "i"), "")
      // "/ 3.5 oz name" or "/ 10 tbsp name"
      .replace(new RegExp(`^\\/\\s*[\\d.]+\\s*(${units})\\s+`, "i"), "")
      // "100g name" or "100 g name" with nothing after (whole string is just units)
      .replace(new RegExp(`^[\\d.]+\\s*(${units})$`, "i"), "")
      .trim();
    return cleaned || raw; // fall back to original if we over-stripped
  }

  // Consolidate ingredients: group by normalized name + unit
  type ConsolidatedIngredient = {
    name: string;
    quantity: number | null;
    unit: string | null;
    raw: string;
    category: IngredientCategory;
    numericQty: boolean;
  };

  const consolidated = new Map<string, ConsolidatedIngredient>();

  for (const planItem of mealPlan.items) {
    for (const ingredient of planItem.recipe.ingredients) {
      const cleanedName = cleanIngredientName(ingredient.name);
      const normalizedName = cleanedName.toLowerCase().trim();
      const normalizedUnit = ingredient.unit
        ? ingredient.unit.toLowerCase().trim()
        : "";
      const key = `${normalizedName}||${normalizedUnit}`;

      const existing = consolidated.get(key);
      if (existing) {
        // Try to sum quantities if both are numeric
        if (
          existing.numericQty &&
          ingredient.quantity !== null &&
          ingredient.quantity !== undefined
        ) {
          existing.quantity = (existing.quantity ?? 0) + ingredient.quantity;
        }
      } else {
        const hasNumericQty =
          ingredient.quantity !== null && ingredient.quantity !== undefined;
        consolidated.set(key, {
          name: cleanedName,
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit ?? null,
          raw: ingredient.raw,
          category: ingredient.category as IngredientCategory,
          numericQty: hasNumericQty,
        });
      }
    }
  }

  // Sort by category order then name
  const ingredientList = Array.from(consolidated.values()).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    if (catA !== catB) return catA - catB;
    return a.name.localeCompare(b.name);
  });

  // Build the week label for the list name
  const weekDate = new Date(weekStartDate);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = monthNames[weekDate.getUTCMonth()];
  const day = weekDate.getUTCDate();
  const listName = `Week of ${month} ${day}`;

  // Delete any previous list for this mealPlanId
  await prisma.groceryList.deleteMany({
    where: {
      userId,
      mealPlanId: mealPlan.id,
    },
  });

  // Create the new grocery list with items
  const newList = await prisma.groceryList.create({
    data: {
      userId,
      mealPlanId: mealPlan.id,
      name: listName,
      sentToAlexa: false,
      items: {
        create: ingredientList.map((ingredient, index) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          raw: ingredient.raw,
          category: ingredient.category,
          isChecked: false,
          sortOrder: index,
        })),
      },
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ list: newList }, { status: 201 });
}
