import { contact } from "@/data/contact";
import type { Bottle } from "@/data/types";
import { formatPrice } from "@/lib/format";

export interface ResolvedLine {
  bottle: Bottle;
  quantity: number;
}

export function totalCents(lines: ReadonlyArray<ResolvedLine>): number {
  return lines.reduce((sum, line) => sum + line.bottle.priceCents * line.quantity, 0);
}

/** Commande envoyée par e-mail en attendant la boutique en ligne. */
export function orderMailto(lines: ReadonlyArray<ResolvedLine>): string {
  const body = [
    "Bonjour Paolo,",
    "",
    "Je souhaite commander :",
    ...lines.map(
      ({ bottle, quantity }) =>
        `- ${quantity} × ${bottle.name} (${bottle.producer}) : ${formatPrice(bottle.priceCents * quantity, bottle.currency)}`,
    ),
    "",
    `Total indicatif : ${formatPrice(totalCents(lines), "CHF")}`,
    "",
    "Adresse de livraison :",
    "",
  ].join("\n");
  const subject = "Commande depuis le site BluePoint";
  return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
