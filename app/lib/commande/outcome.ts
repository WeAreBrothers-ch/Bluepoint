import type { IsoDate } from "../metafields/definitions";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import type { PhoneOrderErrors } from "./schema";
import type { PaymentChoice } from "./types";

/** Résultat de « Créer la commande », tel qu'affiché par la page. */

export type PhoneOrderOutcome =
  | { readonly kind: "invalide"; readonly message: string; readonly errors: PhoneOrderErrors }
  | { readonly kind: "erreur"; readonly message: string }
  /** Une demande avec la même clé est déjà en cours (double clic). */
  | { readonly kind: "en_cours"; readonly message: string }
  | {
      readonly kind: "commande";
      readonly orderId: string;
      readonly orderName: string;
      /** Vrai si la commande reste à payer (sur facture ou à la livraison). */
      readonly paymentPending: boolean;
      readonly payment: PaymentChoice;
      readonly requestedDate: IsoDate;
      /** Remarques non bloquantes (modèle de délai approché, métachamps à vérifier…). */
      readonly warnings: readonly string[];
      /** La commande existait déjà pour cette clé : rien n'a été recréé. */
      readonly replayed: boolean;
    }
  | {
      /** Commande provisoire créée mais pas terminée (conditions de paiement indisponibles). */
      readonly kind: "brouillon";
      readonly draftOrderId: string;
      readonly draftName: string;
      readonly message: string;
    };

export const MESSAGES = {
  invalide: "Il manque quelque chose\u202F: regardez les champs signalés en rouge.",
  indisponible: "Shopify ne répond pas pour le moment. Réessayez\u202F: la commande ne sera pas enregistrée deux fois.",
  enCours: "La commande est en train d’être enregistrée. Patientez quelques secondes.",
  base: "La commande n’a pas pu être enregistrée. Réessayez.",
  recharger: "Rechargez la page, puis recommencez la commande.",
  brouillonSansConditions:
    "La commande est enregistrée mais pas terminée\u202F: Shopify n’accepte pas encore le paiement plus tard sur cette boutique. " +
    "Elle n’a pas été notée payée. Terminez-la dans Shopify ou appelez la personne qui s’occupe de la boutique.",
  metachampsNonPoses:
    "Attention\u202F: le jour de livraison n’a pas été enregistré, la commande n’apparaîtra pas dans l’agenda. " +
    "Prévenez la personne qui s’occupe de la boutique.",
} as const;

export function netTermsWarning(requestedDays: number, appliedDays: number | null): string {
  return appliedDays === null
    ? `Le délai de ${requestedDays} jours n’existe pas dans Shopify\u202F: un autre délai a été appliqué.`
    : `Le délai de ${requestedDays} jours n’existe pas dans Shopify\u202F: le client aura ${appliedDays} jours pour payer.`;
}

interface UserErrorLike {
  readonly field: readonly string[] | null;
  readonly message: string;
}

/** Shopify refuse-t-il la commande à cause des conditions de paiement (offre, autorisation) ? */
export function isPaymentTermsRefusal(userErrors: readonly UserErrorLike[]): boolean {
  return userErrors.some(
    (error) =>
      (error.field ?? []).some((part) => part.toLowerCase().includes("paymentterms")) ||
      /payment ?terms|conditions de paiement/i.test(error.message),
  );
}

/** Refus de Shopify : phrase simple ; le détail brut (souvent en anglais) reste pour la personne qui assiste. */
export function refusalMessage(detail: string): string {
  return `Shopify n’a pas accepté la commande. ${plainShopifyRefusal(detail) ?? "Vérifiez le client et les vins, puis réessayez."}`;
}
