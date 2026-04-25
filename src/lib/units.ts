// ─────────────────────────────────────────────
// Unit conversion and ingredient scaling
// ─────────────────────────────────────────────

// Conversion table: everything normalized to base units
// Volume base: ml
// Weight base: grams

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  "fl oz": 29.574,
  "fluid ounce": 29.574,
  "fluid ounces": 29.574,
  cup: 236.588,
  cups: 236.588,
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  L: 1000,
  liter: 1000,
  liters: 1000,
  gallon: 3785.41,
  gallons: 3785.41,
};

const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

// Pretty output thresholds: prefer larger units when quantity >= this value in base unit
const VOLUME_THRESHOLDS: [number, string][] = [
  [946, "qt"],
  [473, "pt"],
  [236, "cup"],
  [29.574, "fl oz"],
  [14.787, "tbsp"],
  [4.929, "tsp"],
];

const WEIGHT_THRESHOLDS: [number, string][] = [
  [453.592, "lb"],
  [28.3495, "oz"],
  [1, "g"],
];

export interface ScaledQuantity {
  quantity: number;
  unit: string;
  display: string; // e.g. "1 cup", "1.5 lb"
}

// ─────────────────────────────────────────────
// Scale a quantity from base servings to target
// ─────────────────────────────────────────────

export function scaleQuantity(
  quantity: number,
  unit: string | null,
  baseServings: number,
  targetServings: number
): ScaledQuantity {
  const scaleFactor = targetServings / baseServings;
  const rawQuantity = quantity * scaleFactor;

  if (!unit) {
    return {
      quantity: roundNicely(rawQuantity),
      unit: "",
      display: formatQuantity(rawQuantity),
    };
  }

  const lowerUnit = unit.toLowerCase().trim();

  // Volume unit
  if (lowerUnit in VOLUME_TO_ML) {
    const ml = rawQuantity * VOLUME_TO_ML[lowerUnit];
    return convertVolume(ml);
  }

  // Weight unit
  if (lowerUnit in WEIGHT_TO_GRAMS) {
    const grams = rawQuantity * WEIGHT_TO_GRAMS[lowerUnit];
    return convertWeight(grams);
  }

  // Unknown unit — just scale numerically
  return {
    quantity: roundNicely(rawQuantity),
    unit,
    display: `${formatQuantity(rawQuantity)} ${unit}`,
  };
}

function convertVolume(ml: number): ScaledQuantity {
  for (const [threshold, unit] of VOLUME_THRESHOLDS) {
    if (ml >= threshold * 0.9) {
      const quantity = roundNicely(ml / VOLUME_TO_ML[unit]);
      return { quantity, unit, display: `${formatQuantity(quantity)} ${unit}` };
    }
  }
  const quantity = roundNicely(ml / VOLUME_TO_ML["tsp"]);
  return { quantity, unit: "tsp", display: `${formatQuantity(quantity)} tsp` };
}

function convertWeight(grams: number): ScaledQuantity {
  for (const [threshold, unit] of WEIGHT_THRESHOLDS) {
    if (grams >= threshold * 0.9) {
      const quantity = roundNicely(grams / WEIGHT_TO_GRAMS[unit]);
      return { quantity, unit, display: `${formatQuantity(quantity)} ${unit}` };
    }
  }
  return { quantity: roundNicely(grams), unit: "g", display: `${formatQuantity(grams)} g` };
}

// ─────────────────────────────────────────────
// Combine ingredients across recipes for grocery list
// ─────────────────────────────────────────────

export interface CombinedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  display: string;
  category: string;
}

export function combineIngredients(
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    raw: string;
    category: string;
    scaleFactor?: number; // servings/baseServings
  }>
): CombinedIngredient[] {
  const groups = new Map<string, typeof ingredients>();

  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ing);
  }

  const result: CombinedIngredient[] = [];

  for (const [name, group] of groups) {
    const scaledGroup = group.map((ing) => ({
      ...ing,
      quantity: ing.quantity != null ? ing.quantity * (ing.scaleFactor ?? 1) : null,
    }));

    // If any item has no quantity, can't combine — just show raw
    if (scaledGroup.some((i) => i.quantity == null)) {
      result.push({
        name,
        quantity: null,
        unit: null,
        display: group[0].raw,
        category: group[0].category,
      });
      continue;
    }

    // Try to combine in a common unit (convert all to base, sum, convert back)
    const unit = scaledGroup[0].unit?.toLowerCase() ?? null;
    const allSameType = scaledGroup.every((i) => {
      const u = i.unit?.toLowerCase() ?? null;
      return (
        (u && unit && u in VOLUME_TO_ML && unit in VOLUME_TO_ML) ||
        (u && unit && u in WEIGHT_TO_GRAMS && unit in WEIGHT_TO_GRAMS) ||
        u === unit
      );
    });

    if (!allSameType) {
      // Just list them separately
      for (const ing of scaledGroup) {
        result.push({
          name,
          quantity: ing.quantity,
          unit: ing.unit,
          display: ing.raw,
          category: ing.category,
        });
      }
      continue;
    }

    if (unit && unit in VOLUME_TO_ML) {
      const totalMl = scaledGroup.reduce(
        (sum, i) => sum + i.quantity! * VOLUME_TO_ML[i.unit!.toLowerCase()],
        0
      );
      const converted = convertVolume(totalMl);
      result.push({
        name,
        quantity: converted.quantity,
        unit: converted.unit,
        display: `${converted.display} ${name}`,
        category: group[0].category,
      });
    } else if (unit && unit in WEIGHT_TO_GRAMS) {
      const totalG = scaledGroup.reduce(
        (sum, i) => sum + i.quantity! * WEIGHT_TO_GRAMS[i.unit!.toLowerCase()],
        0
      );
      const converted = convertWeight(totalG);
      result.push({
        name,
        quantity: converted.quantity,
        unit: converted.unit,
        display: `${converted.display} ${name}`,
        category: group[0].category,
      });
    } else {
      const total = scaledGroup.reduce((sum, i) => sum + i.quantity!, 0);
      const rounded = roundNicely(total);
      result.push({
        name,
        quantity: rounded,
        unit: unit ?? undefined,
        display: unit ? `${formatQuantity(rounded)} ${unit} ${name}` : `${formatQuantity(rounded)} ${name}`,
        category: group[0].category,
      });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────

function roundNicely(n: number): number {
  // Round to nearest 1/8 for cooking precision
  return Math.round(n * 8) / 8;
}

function formatQuantity(n: number): string {
  if (n === Math.floor(n)) return n.toString();

  const fractions: [number, string][] = [
    [0.125, "⅛"], [0.25, "¼"], [0.333, "⅓"],
    [0.375, "⅜"], [0.5, "½"], [0.625, "⅝"],
    [0.667, "⅔"], [0.75, "¾"], [0.875, "⅞"],
  ];

  const whole = Math.floor(n);
  const frac = n - whole;

  for (const [val, symbol] of fractions) {
    if (Math.abs(frac - val) < 0.06) {
      return whole > 0 ? `${whole} ${symbol}` : symbol;
    }
  }

  return n.toFixed(2).replace(/\.?0+$/, "");
}
