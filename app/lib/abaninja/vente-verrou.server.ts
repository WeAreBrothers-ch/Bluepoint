import { logError } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { claimInvoiceSlot, releaseRefused } from "./repository.server";
import type { AbaNinjaInvoice, ClaimInput } from "./repository-types";
import { ERASE_HINT, SaleInvoiceError } from "./vente-errors";

/**
 * Verrou de la facture AbaNinja d'une commande : une seule facture par commande, même si Eliott
 * touche deux fois le bouton ou si Shopify renvoie son message. Une tentative refusée (rien chez
 * AbaNinja) est libérée pour qu'on puisse recommencer ; tout autre état bloque, avec la marche à suivre.
 */

const DATABASE_DOWN = new SaleInvoiceError("refusee", "La base de l’application ne répond pas. Réessayez dans un instant.");

function blockedBy(row: AbaNinjaInvoice): SaleInvoiceError {
  if (row.state === "creee") {
    const number = row.systemInvoiceNumber === null || row.systemInvoiceNumber === "" ? row.reference : row.systemInvoiceNumber;
    return new SaleInvoiceError("refusee", `La facture ${number} est déjà faite dans AbaNinja, mais l’app n’a pas son PDF.`, [ERASE_HINT]);
  }
  if (row.state === "incertaine") {
    return new SaleInvoiceError("incertaine", "La dernière tentative n’a pas été confirmée par AbaNinja.", [
      `Regardez dans AbaNinja si une facture de référence ${row.reference} existe.`,
      ERASE_HINT,
    ]);
  }
  return new SaleInvoiceError("incertaine", "La facture de cette commande est déjà en train d’être faite. Attendez une minute, puis rechargez la page.");
}

async function claimOnce(input: ClaimInput): Promise<Result<{ readonly claimed: boolean; readonly row: AbaNinjaInvoice }, SaleInvoiceError>> {
  const claim = await claimInvoiceSlot(input);
  if (!claim.ok) {
    logError("Facture AbaNinja : verrou impossible", claim.error, { orderId: input.orderId });
    return failure(DATABASE_DOWN);
  }
  return success({ claimed: claim.value.claimed, row: claim.value.invoice });
}

/** Prend le verrou, ou explique pourquoi la facture ne peut pas être faite maintenant. */
export async function claimSaleInvoice(input: ClaimInput): Promise<Result<void, SaleInvoiceError>> {
  const first = await claimOnce(input);
  if (!first.ok) return first;
  if (first.value.claimed) return success(undefined);
  if (first.value.row.state !== "refusee") return failure(blockedBy(first.value.row));
  const released = await releaseRefused(input.orderId);
  if (!released.ok) {
    logError("Facture AbaNinja : tentative refusée non libérée", released.error, { orderId: input.orderId });
    return failure(DATABASE_DOWN);
  }
  const second = await claimOnce(input);
  if (!second.ok) return second;
  return second.value.claimed ? success(undefined) : failure(blockedBy(second.value.row));
}
