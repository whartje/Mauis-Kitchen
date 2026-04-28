/**
 * Fuzzy matching between a grocery item name and pantry item names.
 *
 * Strategy (in order of specificity):
 * 1. Exact match after normalization
 * 2. One is a substring of the other (e.g. "salt" ⊂ "kosher sea salt")
 * 3. Any meaningful token from the pantry name appears in the grocery name
 *    or vice versa (e.g. "olive oil" tokens ["olive","oil"] vs "extra virgin olive oil")
 */

const STOP_WORDS = new Set([
  "a","an","the","of","and","or","with","for","in","on","at","to","fresh",
  "dried","ground","whole","raw","cooked","frozen","canned","large","small",
  "medium","extra","virgin","organic","unsalted","salted","low","sodium",
  "fat","free","reduced","light","pure","fine","coarse",
]);

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function pantryMatchesGrocery(
  groceryName: string,
  pantryNames: string[]
): boolean {
  const gNorm = normalize(groceryName);
  const gTokens = tokens(groceryName);

  for (const pantry of pantryNames) {
    const pNorm = normalize(pantry);
    const pTokens = tokens(pantry);

    // 1. Exact
    if (gNorm === pNorm) return true;

    // 2. Substring either way
    if (gNorm.includes(pNorm) || pNorm.includes(gNorm)) return true;

    // 3. Any meaningful token from pantry found in grocery tokens (and vice versa)
    // Use the shorter token list as the probe to avoid false positives from
    // single-char or stop-word-only matches.
    const probe = pTokens.length <= gTokens.length ? pTokens : gTokens;
    const haystack = pTokens.length <= gTokens.length ? gTokens : pTokens;
    if (probe.length > 0 && probe.some((t) => haystack.includes(t))) return true;
  }

  return false;
}
