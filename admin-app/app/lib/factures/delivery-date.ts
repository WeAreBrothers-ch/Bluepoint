import { swissIsoDate } from "../agenda/dates";
import type { IsoDate } from "../metafields/definitions";
import { firstValidPhone } from "./phone";
import type { InvoiceContactOrder, InvoiceFulfillment } from "./order-query";

/** Données de la commande utiles à la facture, hors moteur `facture-qr`. */

function instantOf(fulfillment: InvoiceFulfillment): number {
  return new Date(fulfillment.deliveredAt ?? fulfillment.createdAt).getTime();
}

/**
 * Date de livraison (mention obligatoire, art. 26 LTVA) : la plus récente des expéditions
 * réussies, à l'heure suisse ; `null` si la commande n'a encore rien expédié.
 */
export function deliveryDateOf(fulfillments: readonly InvoiceFulfillment[]): IsoDate | null {
  const instants = fulfillments
    .filter((fulfillment) => fulfillment.status === "SUCCESS")
    .map(instantOf)
    .filter((instant) => !Number.isNaN(instant));
  return instants.length === 0 ? null : swissIsoDate(new Date(Math.max(...instants)));
}

export interface CustomerContact {
  readonly email: string | null;
  readonly phone: string | null;
}

export function contactOf(order: InvoiceContactOrder): CustomerContact {
  const email = order.email?.trim() || order.customer?.defaultEmailAddress?.emailAddress.trim() || null;
  const phone = firstValidPhone([
    order.phone,
    order.shippingAddress?.phone,
    order.billingAddress?.phone,
    order.customer?.defaultPhoneNumber?.phoneNumber,
  ]);
  return { email, phone };
}
