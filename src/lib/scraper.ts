export interface ScrapedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  raw: string;
  notes: string | null;
  category: "PRODUCE" | "PROTEIN" | "DAIRY" | "GRAINS" | "PANTRY" | "SPICES" | "FROZEN" | "BEVERAGES" | "OTHER";
  sortOrder: number;
}

export interface ScrapedInstruction {
  stepNumber: number;
  text: string;
}

export interface ScrapedRecipe {
  title: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  imageUrl: string | null;
  ingredients: ScrapedIngredient[];
  instructions: ScrapedInstruction[];
}

export interface ScrapeResult {
  recipe: ScrapedRecipe;
  sourceUrl: string;
  sourceName: string;
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

export async function scrapeRecipeFromUrl(url: string): Promise<ScrapeResult> {
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  const html = await fetchHtml(url);

  // Detect Cloudflare / bot challenge pages
  if (isChallengePage(html)) {
    throw new Error(
      "This site uses bot protection that blocks automated access. Try copying the recipe text and pasting it manually."
    );
  }

  // Try JSON-LD first, then microdata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd = (extractJsonLd(html) ?? extractMicrodata(html)) as any;

  if (!jsonLd || !jsonLd.name) {
    throw new Error("No structured recipe data found on this page.");
  }

  const prepTime = parseIsoDuration(jsonLd.prepTime);
  const cookTime = parseIsoDuration(jsonLd.cookTime);
  const totalTime =
    parseIsoDuration(jsonLd.totalTime) ??
    (prepTime != null && cookTime != null ? prepTime + cookTime : null);

  const ingredients = (jsonLd.recipeIngredient ?? []).map(
    (raw: string, idx: number) => parseIngredient(raw, idx)
  );

  const instructions = parseInstructions(jsonLd.recipeInstructions ?? []);
  const tags = buildTags(jsonLd);
  const difficulty = estimateDifficulty(totalTime, instructions.length);
  const servings = parseServings(jsonLd.recipeYield);
  const imageUrl = extractImageUrl(jsonLd.image);

  return {
    recipe: {
      title: String(jsonLd.name).trim(),
      description: jsonLd.description ? String(jsonLd.description).trim() : null,
      servings,
      prepTime,
      cookTime,
      totalTime,
      difficulty,
      tags,
      imageUrl,
      ingredients,
      instructions,
    },
    sourceUrl: url,
    sourceName: hostname,
  };
}

// ─────────────────────────────────────────────
// Fetch HTML
// ─────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: HTTP ${response.status}`);
  }

  return response.text();
}

// ─────────────────────────────────────────────
// Cloudflare / bot challenge detection
// ─────────────────────────────────────────────

function isChallengePage(html: string): boolean {
  return (
    html.includes("cf-browser-verification") ||
    html.includes("cf_chl_prog") ||
    html.includes("jschl_vc") ||
    (html.includes("cloudflare") && html.length < 10000)
  );
}

// ─────────────────────────────────────────────
// Microdata extraction (schema.org/Recipe in HTML attributes)
// ─────────────────────────────────────────────

function extractMicrodata(html: string): Record<string, unknown> | null {
  if (!/itemtype=["'][^"']*schema\.org\/Recipe["']/i.test(html)) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {};

  // Single-value string properties — look for content="..." or inner text
  const stringProps = [
    "name", "description", "recipeYield", "prepTime", "cookTime",
    "totalTime", "recipeCategory", "recipeCuisine",
  ];
  for (const prop of stringProps) {
    // content attribute (meta tags)
    const contentMatch = html.match(
      new RegExp(`itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")
    ) ?? html.match(
      new RegExp(`content=["']([^"']+)["'][^>]*itemprop=["']${prop}["']`, "i")
    );
    if (contentMatch) {
      result[prop] = contentMatch[1].trim();
      continue;
    }
    // Inner text of any element
    const textMatch = html.match(
      new RegExp(`itemprop=["']${prop}["'][^>]*>([^<]{1,300})<`, "i")
    );
    if (textMatch) result[prop] = textMatch[1].trim();
  }

  // Multi-value: ingredients
  const ingMatches = [
    ...html.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([^<]{2,200})</gi),
  ];
  if (ingMatches.length > 0) {
    result.recipeIngredient = ingMatches.map((m) => m[1].trim()).filter(Boolean);
  }

  // Multi-value: instructions
  const instrMatches = [
    ...html.matchAll(/itemprop=["'](?:recipeInstructions|step)"[^>]*>([^<]{5,1000})</gi),
  ];
  if (instrMatches.length > 0) {
    result.recipeInstructions = instrMatches
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  // Image
  const imgMatch =
    html.match(/itemprop=["']image["'][^>]*(?:src|content)=["']([^"']+)["']/i) ??
    html.match(/(?:src|content)=["']([^"']+)["'][^>]*itemprop=["']image["']/i);
  if (imgMatch) result.image = imgMatch[1];

  return result.name ? result : null;
}

// ─────────────────────────────────────────────
// JSON-LD extraction
// ─────────────────────────────────────────────

function extractJsonLd(html: string): Record<string, unknown> | null {
  // Find all <script type="application/ld+json"> blocks
  const scriptRegex = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      const found = findRecipeInLd(raw);
      if (found) return found;
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecipeInLd(data: any): Record<string, unknown> | null {
  if (!data) return null;

  // Direct recipe object
  if (data["@type"] === "Recipe") return data;

  // Array of types: ["Recipe", "Article"]
  if (Array.isArray(data["@type"]) && data["@type"].includes("Recipe")) return data;

  // @graph wrapper
  if (data["@graph"] && Array.isArray(data["@graph"])) {
    for (const item of data["@graph"]) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }

  // Array of LD objects
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Field parsers
// ─────────────────────────────────────────────

function parseIsoDuration(dur: unknown): number | null {
  if (!dur) return null;
  const str = String(dur).trim();
  if (/^\d+$/.test(str)) return parseInt(str);
  const match = str.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  const days = parseInt(match[1] ?? "0");
  const hours = parseInt(match[2] ?? "0");
  const minutes = parseInt(match[3] ?? "0");
  const total = days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : null;
}

function parseServings(yield_: unknown): number {
  if (!yield_) return 4;
  const str = Array.isArray(yield_) ? String(yield_[0]) : String(yield_);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 4;
}

function extractImageUrl(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    return typeof first === "string" ? first : (first?.url ?? null);
  }
  if (typeof image === "object" && image !== null && "url" in image) {
    return (image as { url: string }).url;
  }
  return null;
}

function buildTags(ld: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const add = (v: unknown) => {
    if (!v) return;
    const str = String(v).trim().toLowerCase();
    if (str && str.length < 40 && !tags.includes(str)) tags.push(str);
  };

  const addList = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(add);
    else String(v).split(",").forEach(s => add(s.trim()));
  };

  addList(ld.recipeCuisine);
  addList(ld.recipeCategory);
  addList(ld.keywords);

  return tags.slice(0, 6);
}

function estimateDifficulty(
  totalMinutes: number | null,
  stepCount: number
): "EASY" | "MEDIUM" | "HARD" {
  if (totalMinutes != null && totalMinutes <= 30 && stepCount <= 6) return "EASY";
  if ((totalMinutes != null && totalMinutes > 90) || stepCount > 10) return "HARD";
  return "MEDIUM";
}

// ─────────────────────────────────────────────
// Ingredient parsing
// ─────────────────────────────────────────────

const UNITS_RE = [
  "cups?", "tablespoons?", "tbsps?", "tbs",
  "teaspoons?", "tsps?",
  "pounds?", "lbs?",
  "ounces?", "oz",
  "grams?", "kilograms?", "kg",
  "milliliters?", "ml", "liters?",
  "pints?", "quarts?", "qt", "gallons?",
  "cloves?", "heads?", "cans?", "packages?",
  "stalks?", "slices?", "pieces?", "sprigs?",
  "handfuls?", "bunches?", "pinch(?:es)?", "dash(?:es)?",
  "inch(?:es)?",
].join("|");

const FRAC_RE = "(?:\\d+\\s+)?(?:\\d+\\/\\d+|[¼½¾⅓⅔⅛⅜⅝⅞])";
const NUM_RE = `(?:${FRAC_RE}|\\d+(?:\\.\\d+)?)`;
const ING_RE = new RegExp(`^(${NUM_RE})\\s*(?:(${UNITS_RE})\\.?\\s+)?(.+)$`, "i");

const VAGUE = ["to taste", "as needed", "optional", "to serve", "a pinch", "a dash"];

const PRODUCE = ["tomato", "onion", "garlic", "pepper", "carrot", "celery", "spinach", "kale", "lettuce", "cucumber", "zucchini", "broccoli", "cauliflower", "mushroom", "potato", "squash", "lemon", "lime", "orange", "apple", "banana", "avocado", "corn", "pea", "basil", "cilantro", "parsley", "mint", "thyme", "rosemary", "ginger", "scallion", "leek", "shallot", "beet", "eggplant", "asparagus"];
const PROTEIN = ["chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna", "shrimp", "tofu", "tempeh", "egg", "lentil", "chickpea", "black bean", "kidney bean", "edamame", "seitan"];
const DAIRY = ["milk", "cream", "butter", "cheese", "yogurt", "sour cream", "cream cheese", "parmesan", "mozzarella", "cheddar", "feta", "ricotta", "ghee"];
const GRAINS = ["flour", "bread", "pasta", "rice", "oat", "quinoa", "barley", "couscous", "noodle", "tortilla", "cracker", "panko", "breadcrumb", "cornmeal"];
const SPICES = ["salt", "pepper", "cumin", "paprika", "turmeric", "cinnamon", "cayenne", "chili", "oregano", "bay leaf", "cardamom", "coriander", "nutmeg", "allspice", "curry", "vanilla"];
const PANTRY_KW = ["oil", "vinegar", "soy sauce", "tamari", "coconut milk", "broth", "stock", "honey", "maple syrup", "sugar", "mustard", "hot sauce", "baking", "yeast", "chocolate", "tahini", "miso", "can ", "nutritional yeast", "nut butter"];

function categorize(name: string): ScrapedIngredient["category"] {
  const l = name.toLowerCase();
  if (PRODUCE.some(p => l.includes(p))) return "PRODUCE";
  if (PROTEIN.some(p => l.includes(p))) return "PROTEIN";
  if (DAIRY.some(p => l.includes(p))) return "DAIRY";
  if (GRAINS.some(p => l.includes(p))) return "GRAINS";
  if (SPICES.some(p => l.includes(p))) return "SPICES";
  if (PANTRY_KW.some(p => l.includes(p))) return "PANTRY";
  return "OTHER";
}

function parseFraction(str: string): number {
  const fm: Record<string, number> = {
    "¼": 0.25, "½": 0.5, "¾": 0.75,
    "⅓": 0.333, "⅔": 0.667,
    "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
  };
  for (const [sym, val] of Object.entries(fm)) {
    if (str.includes(sym)) {
      const whole = parseFloat(str.replace(sym, "").trim()) || 0;
      return whole + val;
    }
  }
  const m = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  const f = str.match(/^(\d+)\/(\d+)$/);
  if (f) return parseInt(f[1]) / parseInt(f[2]);
  return parseFloat(str);
}

const UNIT_MAP: Record<string, string> = {
  tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp",
  cup: "cup", cups: "cup",
  pound: "lb", pounds: "lb", lbs: "lb",
  ounce: "oz", ounces: "oz",
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  milliliter: "ml", milliliters: "ml",
  liter: "L", liters: "L",
  pint: "pt", pints: "pt",
  quart: "qt", quarts: "qt",
  gallon: "gal", gallons: "gal",
};

function normalizeUnit(u: string | null): string | null {
  if (!u) return null;
  return UNIT_MAP[u.toLowerCase()] ?? u.toLowerCase();
}

function parseIngredient(raw: string, idx: number): ScrapedIngredient {
  const trimmed = raw.trim();
  const isVague = VAGUE.some(p => trimmed.toLowerCase().includes(p));

  if (isVague) {
    return { name: trimmed, quantity: null, unit: null, raw: trimmed, notes: null, category: categorize(trimmed), sortOrder: idx };
  }

  const m = trimmed.match(ING_RE);
  if (m) {
    const qty = parseFraction(m[1]);
    const unit = normalizeUnit(m[2] ?? null);
    const rest = m[3].trim();
    const notesM = rest.match(/^(.+?)\s*[,\(](.+)$/);
    const name = notesM ? notesM[1].trim() : rest;
    const notes = notesM ? notesM[2].replace(/[()]/g, "").trim() : null;
    return { name, quantity: isNaN(qty) ? null : qty, unit, raw: trimmed, notes, category: categorize(name), sortOrder: idx };
  }

  return { name: trimmed, quantity: null, unit: null, raw: trimmed, notes: null, category: categorize(trimmed), sortOrder: idx };
}

function parseInstructions(raw: unknown[]): ScrapedInstruction[] {
  return raw
    .map((step, idx) => {
      let text = "";
      if (typeof step === "string") {
        text = step.trim();
      } else if (typeof step === "object" && step !== null) {
        const s = step as Record<string, unknown>;
        // Handle HowToStep with itemListElement
        if (s.itemListElement && Array.isArray(s.itemListElement)) {
          text = s.itemListElement.map((i: unknown) => {
            const item = i as Record<string, unknown>;
            return String(item.text ?? "");
          }).join(" ");
        } else {
          text = String(s.text ?? s.name ?? "");
        }
        text = text.trim();
      }
      return { stepNumber: idx + 1, text };
    })
    .filter(s => s.text.length > 0);
}
