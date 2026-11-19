import type { InvoiceInput, InvoiceLine } from "@bluepoint/facture-qr";
import { failure, success, type Result } from "../core/result";
import type { AddressInput } from "./address-input";
import type { AbaNinjaInvoiceInput } from "./invoice-input";

/**
 * Facture AbaNinja d'une commande fictive livrée (« J'ai livré ») : prépare, sans rien envoyer, le client
 * d'essai et la facture, à partir des lignes que l'app calcule déjà pour ses propres factures (mêmes prix,
 * même TVA, même total). Fonction pure ; chaque refus est écrit pour Eliott.
 */

/** Début de la référence de toutes les factures d'essai faites par « J'ai livré ». */
export const SALE_TEST_PREFIX = "BP-ESSAI-FACT-";

export interface SaleInvoicePlan {
  readonly reference: string;
  readonly clientName: string;
  readonly clientAddress: AddressInput;
  /** La facture, sans destinataire ni compte bancaire (connus une fois le client créé dans AbaNinja). */
  readonly invoice: Omit<AbaNinjaInvoiceInput, "receiver" | "bankAccountUuid">;
}

type Position = SaleInvoicePlan["invoice"]["positions"][number];

const NOT_YET = "ne passe pas encore dans AbaNinja";

/** « 20261119-110530 » : horodatage UTC à la seconde, comme les autres essais. */
function stampOf(now: Date): string {
  return now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

function swissDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function describe(line: InvoiceLine): string {
  const name = line.volumeLabel === undefined ? line.description : `${line.description} · ${line.volumeLabel}`;
  return (line.producer === undefined ? name : `${name} — ${line.producer}`).slice(0, 500);
}

function refusal(input: InvoiceInput): string | null {
  if (!input.taxesIncluded) return `Les prix de cette commande sont hors TVA : ce cas ${NOT_YET}.`;
  if (input.discounts.length > 0) return `La commande a un rabais : il ${NOT_YET}.`;
  if (input.vatLines.length !== 1) return `La commande a plusieurs taux de TVA : ce cas ${NOT_YET}.`;
  const discounted = input.lines.find((line) => line.totalCents !== line.quantity * line.unitPriceCents);
  return discounted === undefined ? null : `« ${describe(discounted)} » a un rabais : il ${NOT_YET}.`;
}

function positionsOf(input: InvoiceInput, vatPercentage: number): Position[] {
  const wines = input.lines.map((line, index) => ({
    positionNumber: index + 1,
    description: describe(line),
    quantity: line.quantity,
    unitPrice: line.unitPriceCents / 100,
    vatPercentage,
  }));
  if (input.shipping === undefined) return wines;
  const { label, amountCents } = input.shipping;
  return [...wines, { positionNumber: wines.length + 1, description: label, quantity: 1, unitPrice: amountCents / 100, vatPercentage }];
}

function totalCentsOf(positions: readonly Position[]): number {
  return positions.reduce((sum, position) => sum + Math.round(position.unitPrice * 100) * position.quantity, 0);
}

function addressOf(clientName: string, stamp: string): AddressInput {
  return {
    kind: "company",
    name: clientName,
    street: "Rue de l’Essai",
    streetNumber: "1",
    zipCode: "1000",
    state: "VD",
    city: "Lausanne",
    email: `essai-fact-${stamp}@example.com`,
    language: "fr",
    countryCode: "CH",
  };
}

export function planTestSaleInvoice(input: InvoiceInput, now: Date): Result<SaleInvoicePlan, Error> {
  const refused = refusal(input);
  if (refused !== null) return failure(new Error(refused));
  const [vat] = input.vatLines;
  if (vat === undefined) return failure(new Error(`La commande n’a pas de TVA : ce cas ${NOT_YET}.`));
  const positions = positionsOf(input, vat.ratePercent);
  if (Math.abs(totalCentsOf(positions) - input.totalCents) > 1) {
    return failure(new Error("Le total des lignes ne correspond pas au total de la commande : la facture n’est pas faite dans AbaNinja."));
  }
  const stamp = stampOf(now);
  const orderName = input.orderReference ?? "sans numéro";
  const reference = `${SALE_TEST_PREFIX}${orderName.replace(/[^A-Za-z0-9-]/g, "")}-${stamp}`;
  const clientName = `${(input.buyer.company ?? input.buyer.name).slice(0, 80)} · essai BluePoint ${stamp} (à supprimer)`;
  return success({
    reference,
    clientName,
    clientAddress: addressOf(clientName, stamp),
    invoice: {
      reference,
      title: `Facture ${orderName} (essai)`.slice(0, 75),
      currencyCode: "CHF",
      invoiceDate: input.issueDate,
      dueDate: input.dueDate,
      pricesIncludeVat: true,
      terms: input.paymentTerms,
      publicNotes: `Commande ${orderName}, livrée le ${swissDate(input.deliveryDate)}.`,
      positions,
    },
  });
}
