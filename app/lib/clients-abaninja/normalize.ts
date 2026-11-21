/**
 * Mise en forme commune des e-mails et des noms, pour comparer une fiche AbaNinja à un client Shopify
 * sans se laisser tromper par une majuscule, un accent, un tiret ou une forme juridique (« Sàrl », « SA »).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEGAL_FORMS: ReadonlySet<string> = new Set(["sa", "sarl", "gmbh", "ag", "sagl", "srl", "snc", "sas", "ltd"]);
/** Un nom plus court que cela n'est pas assez précis pour être cherché dans un autre (« Bar », « Lac »). */
const MIN_CONTAINED_LENGTH = 8;

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeName(raw: string | null | undefined): string {
  const plain = (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ");
  return plain
    .split(" ")
    .filter((word) => word !== "" && !LEGAL_FORMS.has(word))
    .join(" ");
}

/** Même nom une fois nettoyé, ou nom assez long contenu dans l'autre en mots entiers. */
export function namesMatch(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (left === "" || right === "") return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= MIN_CONTAINED_LENGTH && ` ${longer} `.includes(` ${shorter} `);
}
