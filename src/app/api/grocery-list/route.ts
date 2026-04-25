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

  // ── Unit tables ────────────────────────────────────────────────────────────

  const UNIT_CANONICAL: Record<string, string> = {
    tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
    tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
    cup: "cup", cups: "cup",
    "fl oz": "fl oz", "fluid ounce": "fl oz", "fluid ounces": "fl oz",
    oz: "oz", ounce: "oz", ounces: "oz",
    lb: "lb", pound: "lb", pounds: "lb",
    g: "g", gram: "g", grams: "g",
    kg: "kg", kilogram: "kg", kilograms: "kg",
    ml: "ml", milliliter: "ml", milliliters: "ml",
    l: "l", liter: "l", liters: "l",
    pt: "pt", pint: "pt", pints: "pt",
    qt: "qt", quart: "qt", quarts: "qt",
  };

  // Volume in ml
  const VOL_ML: Record<string, number> = {
    tsp: 4.929, tbsp: 14.787, cup: 236.588,
    "fl oz": 29.574, pt: 473.176, qt: 946.353,
    l: 1000, ml: 1,
  };
  // Weight in grams
  const WEIGHT_G: Record<string, number> = {
    g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
  };

  // Volume thresholds: prefer larger unit when possible
  const VOL_THRESHOLDS: [number, string][] = [
    [946, "qt"], [473, "pt"], [236, "cup"],
    [29.574, "fl oz"], [14.787, "tbsp"], [4.929, "tsp"], [0, "ml"],
  ];
  const WEIGHT_THRESHOLDS: [number, string][] = [
    [453.592, "lb"], [28.3495, "oz"], [0, "g"],
  ];

  function canonicalUnit(unit: string | null | undefined): string {
    if (!unit) return "";
    return UNIT_CANONICAL[unit.toLowerCase().trim()] ?? unit.toLowerCase().trim();
  }

  function bestVolumeUnit(ml: number): { quantity: number; unit: string } {
    for (const [threshold, u] of VOL_THRESHOLDS) {
      if (ml >= threshold * 0.9) {
        return { quantity: Math.round((ml / VOL_ML[u]) * 8) / 8, unit: u };
      }
    }
    return { quantity: Math.round(ml * 8) / 8, unit: "ml" };
  }

  function bestWeightUnit(g: number): { quantity: number; unit: string } {
    for (const [threshold, u] of WEIGHT_THRESHOLDS) {
      if (g >= threshold * 0.9) {
        return { quantity: Math.round((g / WEIGHT_G[u]) * 8) / 8, unit: u };
      }
    }
    return { quantity: Math.round(g * 8) / 8, unit: "g" };
  }

  // ── Name helpers ───────────────────────────────────────────────────────────

  /**
   * Strip measurement prefixes accidentally baked into the ingredient name by Claude.
   * Also recovers the unit when it was orphaned into the name (unit field was left null).
   *
   * Examples:
   *  "100g / 3.5oz chickpea flour", unit="g"  → { name:"chickpea flour", unit:"g" }
   *  "g / 1 cup vegan yogurt",      unit=null  → { name:"vegan yogurt",   unit:"g" }
   *  "/ 10 tbsp soy milk",          unit="ml"  → { name:"soy milk",       unit:"ml" }
   */
  function cleanIngredientName(raw: string, existingUnit: string | null): { name: string; unit: string | null } {
    const u = "ml|l|g|kg|oz|lb|cup|cups|tbsp|tsp|teaspoon|tablespoon|pint|quart|gallon|fl oz";
    const re1 = new RegExp(`^([\\d.]+)\\s*(${u})\\s*/\\s*[\\d.]+\\s*(${u})\\s+(.+)$`, "i");
    const re2 = new RegExp(`^(${u})\\s*/\\s*[\\d.]+\\s*(${u})\\s+(.+)$`, "i");
    const re3 = new RegExp(`^/\\s*[\\d.]+\\s*(${u})\\s+(.+)$`, "i");
    const re4 = new RegExp(`^[\\d.]+\\s*(${u})$`, "i");

    let m: RegExpMatchArray | null;

    // "100g / 3.5oz chickpea flour"
    if ((m = raw.match(re1))) {
      return { name: m[4].trim(), unit: existingUnit ?? canonicalUnit(m[2]) };
    }
    // "g / 1 cup vegan yogurt"  (Claude put unit into name, left unit field null)
    if ((m = raw.match(re2))) {
      return { name: m[3].trim(), unit: existingUnit ?? canonicalUnit(m[1]) };
    }
    // "/ 10 tbsp soy milk"
    if ((m = raw.match(re3))) {
      return { name: m[2].trim(), unit: existingUnit };
    }
    // "500g" alone (whole string is just a measurement — discard)
    if (raw.match(re4)) {
      return { name: "", unit: existingUnit };
    }

    return { name: raw, unit: existingUnit };
  }

  // Strip recipe qualifiers like ", for drizzling", "(optional)", "to taste"
  function stripQualifiers(name: string): string {
    return name
      // Parenthetical measurements mid-name: "(about 10 g / 0.35 oz)", "(approx. 1 cup)"
      .replace(/\s*\((about|approx\.?|approximately|around)\s+[^)]+\)\s*/gi, " ")
      // Leading vague quantity phrases: "a small handful of", "a pinch of", etc.
      .replace(/^a\s+(small\s+|large\s+|heaped\s+|heaping\s+)?(handful|pinch|dash|bunch|few|couple|can|slice|piece)\s+(of\s+)?/i, "")
      // Leading "of " left over after stripping a phrase
      .replace(/^of\s+/i, "")
      // Trailing annotation markers: *, †, ‡, #
      .replace(/[\s*†‡#]+$/, "")
      // Trailing qualifiers after comma
      .replace(/,\s*(for\s+.+|to taste|as needed|if desired|if needed|optional|plus more.*|more to taste.*)$/i, "")
      // " for frying/serving/etc" at end
      .replace(/\s+for\s+(frying|drizzling|brushing|serving|garnish(ing)?|topping|coating|greasing|cooking)(\s+and\s+\w+)?$/i, "")
      // Trailing parenthetical qualifiers: (optional), (to taste)
      .replace(/\s*\((optional|to taste|as needed|if desired|if needed)\)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Normalize name for matching: strip adverbs, lowercase, collapse spaces
  function normalizeName(name: string): string {
    return stripQualifiers(name)
      .toLowerCase()
      .replace(/^(freshly|finely|coarsely|roughly|thinly|lightly|heavily|freshly-ground)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Compound ingredient splitter ──────────────────────────────────────────
  // Splits entries like "spices: 1 tsp paprika, 1 tsp cumin, ¼ tsp garlic powder"
  // into [{name:"smoked paprika", quantity:1, unit:"tsp"}, ...]

  const FRAC_MAP: Record<string, number> = {
    "¼": 0.25, "½": 0.5, "¾": 0.75,
    "⅓": 0.3333, "⅔": 0.6667,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
  };
  const FRAC_CHARS = Object.keys(FRAC_MAP).join("|");
  const UNIT_PAT = "ml|l|g|kg|oz|lb|cups?|tbsp|tablespoons?|tsp|teaspoons?|pint|quart";

  function parseQuantity(str: string): number | null {
    if (str in FRAC_MAP) return FRAC_MAP[str];
    if (str.includes("/")) {
      const [n, d] = str.split("/");
      const val = Number(n) / Number(d);
      return isNaN(val) ? null : val;
    }
    const val = parseFloat(str);
    return isNaN(val) ? null : val;
  }

  function splitCompoundIngredient(
    name: string,
    category: IngredientCategory
  ): Array<{ name: string; quantity: number | null; unit: string | null; category: IngredientCategory }> | null {
    // Must have a "label:" prefix (e.g. "spices:", "for the sauce:")
    const colonIdx = name.indexOf(":");
    if (colonIdx === -1) return null;

    const rest = name.slice(colonIdx + 1).trim();
    if (!rest) return null;

    // Split on commas followed immediately by a quantity (digit or unicode fraction)
    const parts = rest.split(new RegExp(`,\\s*(?=${FRAC_CHARS}|\\d)`));
    if (parts.length <= 1) return null;

    const results: Array<{ name: string; quantity: number | null; unit: string | null; category: IngredientCategory }> = [];

    for (const part of parts) {
      const p = part.trim();
      // Match: [qty] [unit?] [ingredient name]
      const m = p.match(
        new RegExp(`^(${FRAC_CHARS}|\\d+(?:[./]\\d+)?)\\s*(${UNIT_PAT})?\\s+(.+)$`, "i")
      );
      if (m) {
        results.push({
          name: m[3].trim(),
          quantity: parseQuantity(m[1]),
          unit: m[2] ? canonicalUnit(m[2]) : null,
          category,
        });
      } else {
        // No quantity found — keep as-is
        results.push({ name: p, quantity: null, unit: null, category });
      }
    }

    return results.length > 1 ? results : null;
  }

  // ── First pass: group by normalized name ───────────────────────────────────

  type RawBucket = {
    displayName: string;
    category: IngredientCategory;
    raw: string;
    // unit → total quantity (or null when unquantified)
    byUnit: Map<string, number>;
    hasUnquantified: boolean;
  };

  const byName = new Map<string, RawBucket>();

  // Helper to add a single ingredient (name+qty+unit+category) into the byName map
  function addToBucket(
    ingredientName: string,
    quantity: number | null,
    unit: string | null,
    raw: string,
    category: IngredientCategory
  ) {
    const { name: cleanedName, unit: recoveredUnit } = cleanIngredientName(ingredientName, unit);
    const effectiveName = cleanedName || ingredientName;
    const keyName = normalizeName(effectiveName);
    const unitCanon = canonicalUnit(recoveredUnit);
    const hasQty = quantity !== null && quantity !== undefined;

    if (!byName.has(keyName)) {
      byName.set(keyName, {
        displayName: stripQualifiers(effectiveName),
        category,
        raw,
        byUnit: new Map(),
        hasUnquantified: false,
      });
    }
    const bucket = byName.get(keyName)!;

    if (!hasQty) {
      bucket.hasUnquantified = true;
    } else {
      const prev = bucket.byUnit.get(unitCanon) ?? 0;
      bucket.byUnit.set(unitCanon, prev + quantity!);
    }
  }

  for (const planItem of mealPlan.items) {
    for (const ingredient of planItem.recipe.ingredients) {
      // Try to split compound entries like "spices: 1 tsp paprika, 1 tsp cumin"
      const compounds = splitCompoundIngredient(
        ingredient.name,
        ingredient.category as IngredientCategory
      );

      if (compounds) {
        for (const c of compounds) {
          addToBucket(c.name, c.quantity, c.unit, ingredient.raw, c.category);
        }
      } else {
        addToBucket(
          ingredient.name,
          ingredient.quantity ?? null,
          ingredient.unit ?? null,
          ingredient.raw,
          ingredient.category as IngredientCategory
        );
      }
    }
  }

  // ── Second pass: consolidate units within each name group ──────────────────

  type ConsolidatedIngredient = {
    name: string;
    quantity: number | null;
    unit: string | null;
    raw: string;
    category: IngredientCategory;
  };

  const consolidatedList: ConsolidatedIngredient[] = [];

  for (const [, bucket] of byName) {
    const units = [...bucket.byUnit.keys()];

    if (units.length === 0) {
      // Entirely unquantified
      consolidatedList.push({
        name: bucket.displayName,
        quantity: null,
        unit: null,
        raw: bucket.raw,
        category: bucket.category,
      });
      continue;
    }

    // Check if all quantified units are volume
    const allVolume = units.every((u) => u in VOL_ML);
    // Check if all quantified units are weight
    const allWeight = units.every((u) => u in WEIGHT_G);

    if (allVolume) {
      const totalMl = units.reduce((sum, u) => sum + bucket.byUnit.get(u)! * VOL_ML[u], 0);
      const { quantity, unit } = bestVolumeUnit(totalMl);
      const suffix = bucket.hasUnquantified ? " (+ to taste)" : "";
      consolidatedList.push({
        name: bucket.displayName,
        quantity,
        unit,
        raw: bucket.raw + suffix,
        category: bucket.category,
      });
    } else if (allWeight) {
      const totalG = units.reduce((sum, u) => sum + bucket.byUnit.get(u)! * WEIGHT_G[u], 0);
      const { quantity, unit } = bestWeightUnit(totalG);
      const suffix = bucket.hasUnquantified ? " (+ to taste)" : "";
      consolidatedList.push({
        name: bucket.displayName,
        quantity,
        unit,
        raw: bucket.raw + suffix,
        category: bucket.category,
      });
    } else if (units.length === 1) {
      // Single non-volume/weight unit (e.g. "cloves", "slices")
      const u = units[0];
      const qty = bucket.byUnit.get(u)!;
      const suffix = bucket.hasUnquantified ? " (+ to taste)" : "";
      consolidatedList.push({
        name: bucket.displayName,
        quantity: Math.round(qty * 8) / 8,
        unit: u || null,
        raw: bucket.raw + suffix,
        category: bucket.category,
      });
    } else {
      // Mixed units that can't be converted — emit one row per unit
      for (const u of units) {
        const qty = bucket.byUnit.get(u)!;
        consolidatedList.push({
          name: bucket.displayName,
          quantity: Math.round(qty * 8) / 8,
          unit: u || null,
          raw: bucket.raw,
          category: bucket.category,
        });
      }
      if (bucket.hasUnquantified) {
        consolidatedList.push({
          name: bucket.displayName,
          quantity: null,
          unit: null,
          raw: bucket.raw,
          category: bucket.category,
        });
      }
    }
  }

  // Sort by category order then name
  const ingredientList = consolidatedList.sort((a, b) => {
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
