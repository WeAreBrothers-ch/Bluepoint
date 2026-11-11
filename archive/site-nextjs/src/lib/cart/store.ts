/**
 * Panier local : mémorisé dans le navigateur, sans paiement.
 * Le jour où Shopify ou Stripe arrive, ce module est remplacé par leur panier ;
 * les composants ne parlent qu'à `useCart` (voir use-cart.ts).
 */
export interface CartLine {
  slug: string;
  quantity: number;
}

const STORAGE_KEY = "bp-panier";
const MAX_QUANTITY = 120;
const EMPTY: ReadonlyArray<CartLine> = [];

let lines: ReadonlyArray<CartLine> = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.slug === "string" &&
    typeof candidate.quantity === "number" &&
    Number.isInteger(candidate.quantity) &&
    candidate.quantity > 0
  );
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    lines = Array.isArray(parsed) ? parsed.filter(isCartLine) : EMPTY;
  } catch {
    lines = EMPTY;
  }
}

function commit(next: ReadonlyArray<CartLine>): void {
  lines = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : le panier vit le temps de la visite.
  }
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): ReadonlyArray<CartLine> {
  load();
  return lines;
}

export function getServerSnapshot(): ReadonlyArray<CartLine> {
  return EMPTY;
}

function clamp(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(0, Math.round(quantity)));
}

export function addToCart(slug: string, quantity: number): void {
  load();
  const existing = lines.find((line) => line.slug === slug);
  const next = existing
    ? lines.map((line) => (line.slug === slug ? { ...line, quantity: clamp(line.quantity + quantity) } : line))
    : [...lines, { slug, quantity: clamp(quantity) }];
  commit(next.filter((line) => line.quantity > 0));
}

export function setQuantity(slug: string, quantity: number): void {
  load();
  const next = lines.map((line) => (line.slug === slug ? { ...line, quantity: clamp(quantity) } : line));
  commit(next.filter((line) => line.quantity > 0));
}

export function clearCart(): void {
  commit(EMPTY);
}
