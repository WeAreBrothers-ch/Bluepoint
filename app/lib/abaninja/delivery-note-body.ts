import type { ValidDeliveryNoteInput } from "./delivery-note-input";
import { buildPosition } from "./invoice-body";

/**
 * Traduit un bon de livraison validé en corps de requête `{ documents: [...] }`
 * (spec « Delivery Notes » : `isTemplate` obligatoire). Aucun numéro d'article n'est envoyé :
 * un numéro inconnu pourrait créer un produit dans le catalogue AbaNinja.
 */
export function buildDeliveryNoteBody(note: ValidDeliveryNoteInput): { readonly documents: readonly [object] } {
  return {
    documents: [
      {
        isTemplate: false,
        currencyCode: note.currencyCode,
        reference: note.reference,
        ...(note.title === undefined ? {} : { title: note.title }),
        deliveryNoteDate: note.deliveryNoteDate,
        deliveryDate: note.deliveryDate,
        pricesIncludeVat: note.pricesIncludeVat,
        receiver: note.receiver,
        positions: note.positions.map((position) => buildPosition({ ...position, productNumber: undefined })),
      },
    ],
  };
}
