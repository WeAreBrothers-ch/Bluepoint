import { failure, success, type Result } from "../core/result";
import type { AddressInput } from "./address-input";
import { customerLabel, FICTITIOUS_TAG, type TrialOrder, type TrialOrderLine } from "./bl-essai-order";
import { DELIVERY_NOTE_TRIAL_PREFIX } from "./bl-essai-types";
import type { AbaNinjaDeliveryNoteInput } from "./delivery-note-input";
import { todayInZurich } from "./invoice-status";

/**
 * Essai « bon de livraison → facture » : prépare, sans rien envoyer, le client d'essai et le bon
 * de livraison à partir d'une commande fictive. Fonction pure : le message de chaque refus est écrit pour Eliott.
 */

export interface DeliveryNoteTrialPlan {
  readonly reference: string;
  readonly clientName: string;
  readonly address: AddressInput;
  /** Le bon, sans son destinataire (connu une fois le client créé dans AbaNinja). */
  readonly note: Omit<AbaNinjaDeliveryNoteInput, "receiver">;
  readonly totalChf: number;
}

const DEFAULT_VARIANT = "Default Title";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cents(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

/** « 20261119-101500 » : horodatage UTC à la seconde, comme l'essai de connexion. */
function stampOf(now: Date): string {
  return now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
}

function describe(line: TrialOrderLine): string {
  const variant = line.variantTitle?.trim() ?? "";
  const title = line.title.trim();
  return (variant === "" || variant === DEFAULT_VARIANT ? title : `${title} · ${variant}`).slice(0, 500);
}

/** Taux unique de la ligne en pour cent (0.081 → 8.1) ; null si plusieurs taux. */
function vatPercentOf(line: TrialOrderLine): number | null {
  const rates = new Set(line.taxLines.map((tax) => Math.round(tax.rate * 10_000) / 100));
  if (rates.size > 1) return null;
  return [...rates][0] ?? 0;
}

type Position = DeliveryNoteTrialPlan["note"]["positions"][number];

function positionOf(line: TrialOrderLine, index: number): Result<Position, Error> {
  const unit = cents(line.originalUnitPriceSet.shopMoney.amount);
  const total = Math.round((cents(line.discountedTotalSet.shopMoney.amount) * line.currentQuantity) / line.quantity);
  if (!Number.isFinite(unit) || !Number.isFinite(total)) return failure(new Error(`Le prix de « ${describe(line)} » est illisible.`));
  if (Math.abs(unit * line.currentQuantity - total) > 1) {
    return failure(new Error(`« ${describe(line)} » a un rabais : l’essai ne sait pas encore le reprendre.`));
  }
  const vat = vatPercentOf(line);
  if (vat === null) return failure(new Error(`« ${describe(line)} » a plusieurs taux de TVA : l’essai ne sait pas les reprendre.`));
  return success({ positionNumber: index + 1, description: describe(line), quantity: line.currentQuantity, unitPrice: unit / 100, vatPercentage: vat });
}

function positionsOf(order: TrialOrder): Result<Position[], Error> {
  const lines = order.lineItems.nodes.filter((line) => line.currentQuantity > 0);
  if (lines.length === 0) return failure(new Error("La commande ne contient plus aucun vin."));
  const positions: Position[] = [];
  for (const [index, line] of lines.entries()) {
    const position = positionOf(line, index);
    if (!position.ok) return position;
    positions.push(position.value);
  }
  return success(positions);
}

function refusal(order: TrialOrder): string | null {
  if (!order.tags.includes(FICTITIOUS_TAG)) return `La commande ${order.name} n’est pas étiquetée « ${FICTITIOUS_TAG} » : l’essai n’y touche pas.`;
  if (cents(order.currentShippingPriceSet.shopMoney.amount) !== 0) return "La commande a des frais de livraison : l’essai ne sait pas encore les reprendre.";
  if (cents(order.currentTotalDiscountsSet.shopMoney.amount) !== 0) return "La commande a un rabais : l’essai ne sait pas encore le reprendre.";
  return null;
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
    email: `essai-bl-${stamp}@example.com`,
    language: "fr",
    countryCode: "CH",
  };
}

function deliveryDateOf(order: TrialOrder, today: string): string {
  const wished = order.dateSouhaitee?.value ?? "";
  return ISO_DATE.test(wished) && wished >= today ? wished : today;
}

export function planDeliveryNoteTrial(order: TrialOrder, now: Date): Result<DeliveryNoteTrialPlan, Error> {
  const refused = refusal(order);
  if (refused !== null) return failure(new Error(refused));
  const positions = positionsOf(order);
  if (!positions.ok) return positions;
  const totalCents = positions.value.reduce((sum, p) => sum + Math.round(p.unitPrice * 100) * p.quantity, 0);
  if (order.taxesIncluded && Math.abs(totalCents - cents(order.currentTotalPriceSet.shopMoney.amount)) > 1) {
    return failure(new Error("Le total des vins ne correspond pas au total de la commande : l’essai s’arrête."));
  }
  const stamp = stampOf(now);
  const today = todayInZurich(now);
  const reference = `${DELIVERY_NOTE_TRIAL_PREFIX}${order.name.replace(/[^A-Za-z0-9-]/g, "")}-${stamp}`;
  const clientName = `${(customerLabel(order) ?? `Commande ${order.name}`).slice(0, 80)} · essai BluePoint ${stamp} (à supprimer)`;
  return success({
    reference,
    clientName,
    address: addressOf(clientName, stamp),
    totalChf: totalCents / 100,
    note: {
      reference,
      title: `Bon de livraison ${order.name} (essai)`.slice(0, 75),
      deliveryNoteDate: today,
      deliveryDate: deliveryDateOf(order, today),
      pricesIncludeVat: order.taxesIncluded,
      positions: positions.value,
    },
  });
}
