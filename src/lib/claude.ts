import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────
// Recipe normalization schema (Zod)
// ─────────────────────────────────────────────

// Robustly parse JSON that Claude might return with common issues:
// - Bare fractions as numbers: "quantity": 1/2  ->  "quantity": 0.5
// - Markdown code fences (already stripped elsewhere, but handled here too)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseJson(text: string): any {
  let json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  // Convert unicode vulgar fractions to decimals
  const unicodeFractions: Record<string, string> = {
    "½": "0.5", "¼": "0.25", "¾": "0.75",
    "⅓": "0.333", "⅔": "0.667", "⅛": "0.125", "⅜": "0.375", "⅝": "0.625", "⅞": "0.875",
  };
  for (const [frac, dec] of Object.entries(unicodeFractions)) {
    json = json.replaceAll(frac, dec);
  }

  // Convert bare fractions in value position: "quantity": 1/2  ->  "quantity": 0.5
  json = json.replace(/:\s*(\d+)\/(\d+)/g, (_m, num, den) => `: ${Number(num) / Number(den)}`);

  // Remove trailing commas before } or ]
  json = json.replace(/,(\s*[}\]])/g, "$1");

  // Fast path — try parsing as-is first
  try {
    return JSON.parse(json);
  } catch {
    // Fall through to repair
  }

  // Repair unescaped double-quotes inside JSON string values using a simple state machine.
  // Example: "description": "my "great" recipe"  →  "description": "my \"great\" recipe"
  let repaired = "";
  let inStr = false;
  let esc = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (esc) { repaired += ch; esc = false; continue; }
    if (ch === "\\" && inStr) { repaired += ch; esc = true; continue; }
    if (ch === '"') {
      if (!inStr) {
        inStr = true;
        repaired += ch;
      } else {
        // Peek ahead (skip whitespace) to decide if this is a closing quote
        let j = i + 1;
        while (j < json.length && json[j] === " ") j++;
        const next = json[j];
        if (next === ":" || next === "," || next === "}" || next === "]" || j >= json.length) {
          inStr = false;
          repaired += ch;
        } else {
          // Unescaped inner quote — escape it
          repaired += '\\"';
        }
      }
      continue;
    }
    repaired += ch;
  }

  return JSON.parse(repaired);
}

// Claude occasionally returns numeric fields as objects like {value: 4, unit: "servings"}
// These helpers coerce them to plain numbers.
function extractInt(val: unknown, fallback: number): number {
  if (typeof val === "number") return Math.round(val);
  if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    for (const key of ["value", "minutes", "min", "count"]) {
      if (typeof o[key] === "number") return Math.round(o[key] as number);
    }
  }
  return fallback;
}
function extractNullableInt(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return Math.round(val);
  if (val && typeof val === "object") {
    const o = val as Record<string, unknown>;
    for (const key of ["value", "minutes", "min"]) {
      if (typeof o[key] === "number") return Math.round(o[key] as number);
    }
  }
  return null;
}

function coerceQuantity(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // Handle fraction strings like "1/2", "1 1/2"
    const mixed = val.trim().match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = val.trim().match(/^(\d+)\/(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.preprocess(coerceQuantity, z.number().nullable().optional().default(null)),
  unit: z.string().nullable().optional().default(null),
  raw: z.string(),
  notes: z.string().nullable().optional().default(null),
  category: z
    .enum(["PRODUCE", "PROTEIN", "DAIRY", "GRAINS", "PANTRY", "SPICES", "FROZEN", "BEVERAGES", "OTHER"])
    .default("OTHER"),
  sortOrder: z.number().int().default(0),
});

// Claude returns ingredients as strings or objects with varied key names — normalise at array level
const ingredientsSchema = z.preprocess((val) => {
  if (!Array.isArray(val)) return val;
  return val.map((item) => {
    if (typeof item === "string") {
      return { name: item, raw: item, quantity: null, unit: null, notes: null, category: "OTHER", sortOrder: 0 };
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = String(o.name ?? o.ingredient ?? o.item ?? o.description ?? o.title ?? "Unknown");
      const raw = String(o.raw ?? o.original ?? o.full_text ?? o.text ?? o.full ?? name);
      return { ...o, name, raw };
    }
    return item;
  });
}, z.array(IngredientSchema));

// Claude returns instructions in many shapes — normalise at the array level so we have the index
const instructionsSchema = z.preprocess((val) => {
  if (!Array.isArray(val)) return val;
  return val.map((item, idx) => {
    if (typeof item === "string") return { stepNumber: idx + 1, text: item };
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const text = String(o.text ?? o.instruction ?? o.description ?? o.step_text ?? "");
      const sn = o.stepNumber ?? o.step_number ?? o.step ?? o.number;
      return { stepNumber: typeof sn === "number" ? sn : idx + 1, text };
    }
    return item;
  });
}, z.array(z.object({ stepNumber: z.number().int(), text: z.string() })));

const NutritionSchema = z.object({
  calories: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  carbs: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
  fiber: z.number().nullable().optional(),
  sugar: z.number().nullable().optional(),
  sodium: z.number().nullable().optional(),
  servingSize: z.string().nullable().optional(),
});

export const RecipeNormalizationSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  servings: z.preprocess((v) => extractInt(v, 4), z.number().int().min(1).default(4)),
  prepTime: z.preprocess(extractNullableInt, z.number().int().nullable()),
  cookTime: z.preprocess(extractNullableInt, z.number().int().nullable()),
  totalTime: z.preprocess(extractNullableInt, z.number().int().nullable()),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  tags: z.array(z.string()).default([]),
  ingredients: ingredientsSchema,
  instructions: instructionsSchema,
  nutrition: NutritionSchema.nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export type NormalizedRecipe = z.infer<typeof RecipeNormalizationSchema>;

// ─────────────────────────────────────────────
// Normalize recipe from raw text
// ─────────────────────────────────────────────

const NORMALIZATION_SYSTEM_PROMPT = `You are a recipe data extraction specialist. Your job is to convert raw recipe content into a clean, structured JSON object.

Rules:
- Extract ALL fields accurately — do not skip or truncate any content
- If the recipe has multiple ingredient sections (e.g. "For the sauce:", "For the bowls:"), include EVERY ingredient from EVERY section as a flat list in the "ingredients" array. Do not omit any section.
- For ingredient quantities that are vague ("to taste", "a pinch", "1 can"), set quantity and unit to null, and preserve the exact original text in the "raw" field

INGREDIENT NAME RULES (critical):
- The "name" field must contain ONLY the ingredient name — never quantities, units, or measurements
- Examples: "100g / 3.5 oz chickpea flour" → name: "chickpea flour", quantity: 100, unit: "g"
- Examples: "150ml / 10 tbsp soy milk" → name: "soy milk", quantity: 150, unit: "ml"
- Examples: "500g / 17.6 oz firm tofu" → name: "firm tofu", quantity: 500, unit: "g"
- When a recipe lists dual measurements (metric / imperial), pick ONE (prefer metric) for quantity+unit; put only the ingredient name in "name"
- The "raw" field should contain the full original text as written in the recipe

CATEGORY RULES — assign each ingredient to exactly one:
- PRODUCE: fresh fruits, fresh vegetables, fresh herbs (basil, parsley, cilantro, mint, etc.), garlic, onion, ginger, lemons, limes
- PROTEIN: meat, poultry, fish, seafood, eggs, tofu, tempeh, legumes (beans, lentils, chickpeas)
- DAIRY: milk, cream, butter, cheese, yogurt, sour cream (including plant-based/vegan alternatives)
- GRAINS: flour, bread, pasta, rice, oats, cereals, crackers, breadcrumbs, cornmeal, chickpea flour, nutritional yeast
- PANTRY: oils, vinegars, sauces, stocks, broths, canned goods, sugar, honey, baking soda, baking powder, vanilla
- SPICES: salt, pepper, ALL dried spices (paprika, cumin, turmeric, coriander, chili powder, garlic powder, onion powder, etc.), ALL dried herbs (oregano, thyme, rosemary, bay leaves, etc.), spice blends, seasoning mixes
- FROZEN: frozen vegetables, frozen fruits, frozen meals
- BEVERAGES: water, juice, wine, beer, broth used as a beverage, coffee, tea
- OTHER: anything that does not clearly fit the above categories

- Convert prep/cook times to minutes (integers)
- Estimate difficulty: EASY (< 30 min, simple steps), HARD (> 90 min or complex technique), MEDIUM otherwise
- Generate 3-6 relevant tags (cuisine type, dietary restrictions, cooking method, etc.)
- Do NOT rewrite recipe voice or instructions — preserve the original text of instructions
- Output ONLY valid JSON matching the schema exactly. No markdown, no explanation.
- CRITICAL: All double-quote characters within JSON string values MUST be escaped as \\". Never include a bare " inside a string value.`;

export async function normalizeRecipeFromText(rawText: string): Promise<NormalizedRecipe> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: NORMALIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Please normalize this recipe into the required JSON format:\n\n${rawText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  // Strip any markdown code fences if present
  const jsonText = content.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  const parsed = safeParseJson(jsonText);
  return RecipeNormalizationSchema.parse(parsed);
}

// ─────────────────────────────────────────────
// Normalize recipe from image (Vision)
// ─────────────────────────────────────────────

export type ImageNormalizationResult =
  | { multipleRecipes: false; recipe: NormalizedRecipe }
  | { multipleRecipes: true; titles: string[]; imageUrl: string };

export async function normalizeRecipeFromImage(
  imageData: Array<{ buffer: Buffer; type: "image/jpeg" | "image/png" | "image/webp" }> | string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<{ multipleRecipes: false; recipe: NormalizedRecipe } | { multipleRecipes: true; titles: string[] }> {
  // Build image content blocks
  type ImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } };
  let imageBlocks: ImageBlock[];

  if (typeof imageData === "string") {
    const response = await fetch(imageData);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    imageBlocks = [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }];
  } else {
    imageBlocks = imageData.map(({ buffer, type }) => ({
      type: "image",
      source: { type: "base64", media_type: type, data: buffer.toString("base64") },
    }));
  }

  const isMultiPage = imageBlocks.length > 1;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: NORMALIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: isMultiPage
              ? `These ${imageBlocks.length} images are consecutive pages of the same recipe. Combine all the information across all pages into a single complete recipe JSON object.
Output ONLY valid JSON. No markdown, no explanation.`
              : `This image contains a recipe (or possibly multiple recipes).

If there are multiple distinct recipes visible, respond with ONLY this JSON:
{"multipleRecipes": true, "titles": ["Recipe Title 1", "Recipe Title 2"]}

If there is one recipe, extract and normalize it into the required JSON format.
Output ONLY valid JSON. No markdown, no explanation.`,
          },
        ],
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  const jsonText = content.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = safeParseJson(jsonText) as Record<string, unknown>;

  if (parsed.multipleRecipes === true) {
    return { multipleRecipes: true, titles: parsed.titles as string[] };
  }

  const recipe = RecipeNormalizationSchema.parse(parsed);
  return { multipleRecipes: false, recipe };
}

// ─────────────────────────────────────────────
// Normalize a specific recipe from image by title
// ─────────────────────────────────────────────

export async function normalizeSpecificRecipeFromImage(
  imageData: string | Buffer,
  targetTitle: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<NormalizedRecipe> {
  let base64: string;
  if (Buffer.isBuffer(imageData)) {
    base64 = imageData.toString("base64");
  } else {
    const response = await fetch(imageData);
    const arrayBuffer = await response.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: NORMALIZATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `From this image, extract and normalize only the recipe titled "${targetTitle}". Output ONLY valid JSON. No markdown, no explanation.`,
          },
        ],
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  const jsonText = content.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return RecipeNormalizationSchema.parse(safeParseJson(jsonText));
}

// ─────────────────────────────────────────────
// Pantry ingredient identification from image
// ─────────────────────────────────────────────

export async function identifyPantryIngredients(
  imageUrl: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<Array<{ name: string; confidence: number }>> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Identify all visible food ingredients and pantry items in this image.
For each item, provide a confidence score from 0 to 1.
Output ONLY a JSON array: [{"name": "chickpeas", "confidence": 0.95}, ...]
Use common ingredient names, lowercase, singular form (e.g. "tomato" not "tomatoes").`,
          },
        ],
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  const jsonText = content.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return safeParseJson(jsonText);
}
