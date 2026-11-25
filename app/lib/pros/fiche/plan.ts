import type { FicheUpdate } from "./form";
import type { FicheState } from "./state";

/**
 * Ce que la fiche complétée écrit dans Shopify. Logique pure, testée.
 * - la personne : prénom, nom et téléphone (le téléphone sert aussi de repère au site : il le voit sur le client) ;
 * - le téléphone de l'établissement, seulement s'il n'en a pas ;
 * - l'adresse de livraison de l'établissement, et celle de facturation seulement si elle manque aussi.
 */

type AddressType = "SHIPPING" | "BILLING";

export interface FichePlan {
  readonly customer: {
    readonly id: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly phone?: string;
  } | null;
  readonly locationPhone: string | null;
  readonly address: {
    readonly address: {
      readonly address1: string;
      readonly zip: string;
      readonly city: string;
      readonly countryCode: "CH" | "LI";
      readonly firstName?: string;
      readonly lastName?: string;
      readonly phone?: string;
    };
    readonly addressTypes: readonly AddressType[];
  } | null;
}

/** Les clés sans valeur ne sont pas envoyées : Shopify effacerait le champ. */
function known<T extends Record<string, string | null>>(values: T): { [K in keyof T]?: string } {
  const kept: { [K in keyof T]?: string } = {};
  for (const key of Object.keys(values) as (keyof T)[]) {
    const value = values[key];
    if (value !== null && value !== undefined) kept[key] = value;
  }
  return kept;
}

export function planFiche(state: FicheState, update: FicheUpdate): FichePlan {
  const firstName = update.name?.firstName ?? state.firstName;
  const lastName = update.name?.lastName ?? state.lastName;
  const phone = update.phone ?? state.phone;
  const customerChanges = known({ firstName: update.name?.firstName ?? null, lastName: update.name?.lastName ?? null, phone: update.phone });
  return {
    customer: Object.keys(customerChanges).length === 0 ? null : { id: state.customerId, ...customerChanges },
    locationPhone: state.location.phone === null ? update.phone : null,
    address:
      update.address === null
        ? null
        : {
            address: {
              address1: update.address.street,
              zip: update.address.postalCode,
              city: update.address.city,
              countryCode: update.address.country,
              ...known({ firstName, lastName, phone }),
            },
            addressTypes: state.location.hasBillingAddress ? ["SHIPPING"] : ["SHIPPING", "BILLING"],
          },
  };
}
