import type { AbaNinjaSale } from "@prisma/client";
import type { RowOutcome } from "./vente-essai-resume";

/**
 * Ce que l'effacement des bons d'essai dit à Eliott pour chaque essai. Un essai rattaché au client pro fictif
 * ne demande jamais de supprimer ce client : il sert aux autres essais et part une seule fois, à la fin.
 */

/** Un essai à effacer ; `sharedClient` : son bon et sa facture vont au client pro fictif. */
export type ErasingSale = AbaNinjaSale & { readonly sharedClient: boolean };

export function keep(sale: AbaNinjaSale, text: string): RowOutcome {
  return { kind: "gardee", text: `${sale.orderName} : ${text}` };
}

export function byHand(sale: AbaNinjaSale, text: string): RowOutcome {
  return { kind: "a_la_main", text: `${sale.orderName} : ${text}` };
}

/** Le client d'essai propre à cet essai, tel qu'il apparaît dans AbaNinja (fin de la référence). */
export function ownClientHint(sale: AbaNinjaSale): string {
  return `le client « … essai BluePoint ${sale.reference.slice(-15)} (à supprimer) »`;
}

/** Le client à nommer pour cet essai ; null pour le client pro fictif (jamais à supprimer à la main ici). */
export function clientHint(sale: ErasingSale): string | null {
  return sale.sharedClient ? null : ownClientHint(sale);
}

export function noteName(sale: AbaNinjaSale): string {
  const number = sale.noteNumber === null ? "" : ` ${sale.noteNumber}`;
  return `le bon${number} (référence ${sale.reference})`;
}

/** La facture reste : l'essai est oublié par l'app, donc le bon (et le client propre à l'essai) restés sont nommés. */
export function invoiceByHand(sale: ErasingSale, problem: string, todo: string): RowOutcome {
  const client = clientHint(sale);
  if (client === null) {
    return byHand(sale, `${problem} : l’app n’efface ni cette facture, ni ${noteName(sale)}. ${todo} Supprimez ensuite à la main le bon.`);
  }
  const untouched = `l’app n’efface ni cette facture, ni ${noteName(sale)}, ni ${client}.`;
  return byHand(sale, `${problem} : ${untouched} ${todo} Supprimez ensuite à la main le bon et le client.`);
}

/** Les pièces faites dans AbaNinja (bon, facture), dans l'ordre du rapport. */
export function piecesOf(sale: AbaNinjaSale): string[] {
  return [sale.noteUuid === null ? null : "bon", sale.invoiceUuid === null ? null : "facture"].filter((piece) => piece !== null);
}

/** « bon effacé », « facture effacée », « bon, facture et client d’essai effacés » ; null s'il n'y a rien. */
export function erased(pieces: readonly string[]): string | null {
  const last = pieces.at(-1);
  if (last === undefined) return null;
  if (pieces.length === 1) return `${last} ${last === "facture" ? "effacée" : "effacé"}`;
  return `${pieces.slice(0, -1).join(", ")} et ${last} effacés`;
}

export function erasedRow(sale: AbaNinjaSale, pieces: readonly string[]): RowOutcome {
  return { kind: "effacee", text: `${sale.orderName} : ${erased(pieces) ?? "rien n’avait été créé dans AbaNinja"}.` };
}
