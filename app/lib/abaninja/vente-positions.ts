import type { InvoiceInput, InvoiceLine } from "@bluepoint/facture-qr";
import { failure, success, type Result } from "../core/result";
import type { AddressInput } from "./address-input";

/**
 * Lignes d'une vente dans AbaNinja (bon de livraison ou facture), tirées des lignes que l'app calcule déjà
 * pour ses propres factures : mêmes prix, même TVA, même total. Fonctions pures ; chaque refus est écrit pour Eliott.
 */

export interface SalePosition {
  readonly positionNumber: number;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly vatPercentage: number;
}

const NOT_YET = "ne passe pas encore dans AbaNinja";

/** « 20261119-110530 » : horodatage UTC à la seconde, comme les autres essais. */
export function saleStamp(now: Date): string {
  return now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

export function swissDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/** « #1042 » (ou « sans numéro ») et ses seuls chiffres et lettres, pour une référence. */
export function orderNameOf(input: InvoiceInput): string {
  return input.orderReference ?? "sans numéro";
}

export function testReference(prefix: string, input: InvoiceInput, stamp: string): string {
  return `${prefix}${orderNameOf(input).replace(/[^A-Za-z0-9-]/g, "")}-${stamp}`;
}

export function testClientName(input: InvoiceInput, stamp: string): string {
  return `${(input.buyer.company ?? input.buyer.name).slice(0, 80)} · essai BluePoint ${stamp} (à supprimer)`;
}

/**
 * Le client pro fictif : un seul dans AbaNinja, repris par tous les bons et factures d'essai d'un pro. Son nom
 * n'invite pas à le supprimer à la main : « Effacer les factures d'essai » s'en charge, une fois tout le reste effacé.
 */
export const PRO_TEST_CLIENT_NAME = "Client pro fictif · essai BluePoint";

/** Client d'essai d'une pièce : le client pro fictif, partagé, ou un client fait pour cette seule commande. */
export interface TestClient {
  readonly clientName: string;
  readonly clientAddress: AddressInput;
  /** Vrai pour le client pro fictif : il n'est jamais effacé avec une seule pièce, seulement par l'effacement des essais. */
  readonly sharedClient: boolean;
}

/** Client d'essai d'une commande fictive : le client pro fictif pour un pro, sinon un client unique à cette pièce. */
export function testClientOf(input: InvoiceInput, forPro: boolean, stamp: string, emailPrefix: string): TestClient {
  if (forPro) return { clientName: PRO_TEST_CLIENT_NAME, clientAddress: testClientAddress(PRO_TEST_CLIENT_NAME, "client-pro-fictif@example.com"), sharedClient: true };
  const clientName = testClientName(input, stamp);
  return { clientName, clientAddress: testClientAddress(clientName, `${emailPrefix}-${stamp}@example.com`), sharedClient: false };
}

/** Client d'essai fictif, à supprimer avec l'essai. */
export function testClientAddress(clientName: string, email: string): AddressInput {
  return {
    kind: "company",
    name: clientName,
    street: "Rue de l’Essai",
    streetNumber: "1",
    zipCode: "1000",
    state: "VD",
    city: "Lausanne",
    email,
    language: "fr",
    countryCode: "CH",
  };
}

function describe(line: InvoiceLine): string {
  const name = line.volumeLabel === undefined ? line.description : `${line.description} · ${line.volumeLabel}`;
  return (line.producer === undefined ? name : `${name} — ${line.producer}`).slice(0, 500);
}

function refusal(input: InvoiceInput): string | null {
  if (!input.taxesIncluded) return `Les prix de cette commande sont hors TVA : ce cas ${NOT_YET}.`;
  if (input.discounts.length > 0) return `La commande a un rabais : il ${NOT_YET}.`;
  if (input.vatLines.length > 1) return `La commande a plusieurs taux de TVA : ce cas ${NOT_YET}.`;
  if (input.vatLines.length === 0) return `La commande n’a pas de TVA : ce cas ${NOT_YET}.`;
  const discounted = input.lines.find((line) => line.totalCents !== line.quantity * line.unitPriceCents);
  return discounted === undefined ? null : `« ${describe(discounted)} » a un rabais : il ${NOT_YET}.`;
}

function positionsOf(input: InvoiceInput, vatPercentage: number): SalePosition[] {
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

function totalCentsOf(positions: readonly SalePosition[]): number {
  return positions.reduce((sum, position) => sum + Math.round(position.unitPrice * 100) * position.quantity, 0);
}

/** Les vins puis la livraison, au taux de TVA unique de la commande ; refus si le total ne tombe pas juste. */
export function salePositions(input: InvoiceInput): Result<SalePosition[], Error> {
  const refused = refusal(input);
  if (refused !== null) return failure(new Error(refused));
  const vatPercentage = input.vatLines[0]?.ratePercent ?? 0;
  const positions = positionsOf(input, vatPercentage);
  if (positions.length === 0) return failure(new Error("La commande ne contient plus aucun vin."));
  if (Math.abs(totalCentsOf(positions) - input.totalCents) > 1) {
    return failure(new Error("Le total des lignes ne correspond pas au total de la commande : rien n’est fait dans AbaNinja."));
  }
  return success(positions);
}
