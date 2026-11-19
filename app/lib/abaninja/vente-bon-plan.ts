import type { InvoiceInput } from "@bluepoint/facture-qr";
import { success, type Result } from "../core/result";
import type { AddressInput } from "./address-input";
import type { AbaNinjaDeliveryNoteInput } from "./delivery-note-input";
import { todayInZurich } from "./invoice-status";
import { orderNameOf, salePositions, saleStamp, testClientAddress, testClientName, testReference } from "./vente-positions";

/**
 * Bon de livraison AbaNinja d'une commande fictive, fait dès qu'elle arrive : prépare, sans rien envoyer,
 * le client d'essai et le bon, avec les mêmes lignes que la future facture. Fonctions pures.
 */

/** Début de la référence de tous les bons d'essai faits à l'arrivée d'une commande fictive. */
export const SALE_NOTE_TEST_PREFIX = "BP-ESSAI-CMD-";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Le bon, sans son destinataire (connu une fois le client créé dans AbaNinja). */
export type SaleNoteBody = Omit<AbaNinjaDeliveryNoteInput, "receiver">;

export interface SaleNotePlan {
  readonly reference: string;
  readonly clientName: string;
  readonly clientAddress: AddressInput;
  readonly note: SaleNoteBody;
}

/** Corps du bon sous une référence et une date de bon données : à la création, puis à chaque mise à jour. */
export function saleNoteBody(
  input: InvoiceInput,
  meta: { readonly reference: string; readonly orderName: string; readonly noteDate: string; readonly deliveryDate: string },
): Result<SaleNoteBody, Error> {
  const positions = salePositions(input);
  if (!positions.ok) return positions;
  return success({
    reference: meta.reference,
    title: `Bon de livraison ${meta.orderName} (essai)`.slice(0, 75),
    deliveryNoteDate: meta.noteDate,
    deliveryDate: meta.deliveryDate,
    pricesIncludeVat: true,
    positions: positions.value,
  });
}

/** Commande facturée (copie dans l'app) ou livrée avant les bons de livraison : elle n'aura pas de bon. */
export const NOTE_TOO_LATE = "Facture faite avant les bons de livraison : pas de bon pour cette commande.";

export function tooLateForNote(order: { readonly hasInvoice: boolean; readonly fulfillments: readonly { readonly status: string }[] }): boolean {
  return order.hasInvoice || order.fulfillments.some((fulfillment) => fulfillment.status === "SUCCESS");
}

/** Jour de livraison prévu s'il est encore à venir, sinon aujourd'hui (AbaNinja refuse une livraison avant le bon). */
export function plannedDeliveryDate(plannedDate: string | null, today: string): string {
  return plannedDate !== null && ISO_DATE.test(plannedDate) && plannedDate >= today ? plannedDate : today;
}

export function planTestSaleNote(input: InvoiceInput, plannedDate: string | null, now: Date): Result<SaleNotePlan, Error> {
  const stamp = saleStamp(now);
  const today = todayInZurich(now);
  const reference = testReference(SALE_NOTE_TEST_PREFIX, input, stamp);
  const note = saleNoteBody(input, { reference, orderName: orderNameOf(input), noteDate: today, deliveryDate: plannedDeliveryDate(plannedDate, today) });
  if (!note.ok) return note;
  const clientName = testClientName(input, stamp);
  return success({ reference, clientName, clientAddress: testClientAddress(clientName, `essai-cmd-${stamp}@example.com`), note: note.value });
}
