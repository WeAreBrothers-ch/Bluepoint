import type { DeliveryMode, IsoDate } from "../metafields/definitions";
import type { OrderGid } from "../shopify/ids";

/**
 * Agenda des livraisons : une tâche par commande à préparer et livrer,
 * construite à partir de la commande Shopify et de ses métachamps `livraison`.
 */

/** Où en est la livraison (dérivé des expéditions de la commande). */
export type DeliveryStatus = "a_livrer" | "partielle" | "expediee" | "livree";

/** D'où viennent les dates : métachamps de l'app, attributs du panier, ou rien. */
export type DateSource = "metachamp" | "attribut" | "aucune";

/** Statut de paiement affiché par Shopify (`displayFinancialStatus`). */
export type FinancialStatus =
  | "AUTHORIZED"
  | "EXPIRED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "PARTIALLY_REFUNDED"
  | "PENDING"
  | "REFUNDED"
  | "VOIDED";

export interface DeliveryTask {
  readonly orderId: OrderGid;
  /** Numéro lisible de la commande, ex. « #1042 ». */
  readonly name: string;
  readonly customerName: string;
  /** Raison sociale du client professionnel (commande B2B ou adresse avec société). */
  readonly company: string | null;
  /** Client professionnel (restaurant, caviste…) ou particulier. */
  readonly isPro: boolean;
  readonly city: string | null;
  readonly requestedDate: IsoDate | null;
  readonly deadline: IsoDate | null;
  readonly dateSource: DateSource;
  readonly mode: DeliveryMode | null;
  readonly status: DeliveryStatus;
  readonly financialStatus: FinancialStatus | null;
}

/** Degré d'urgence d'une tâche, du plus pressant au moins pressant. */
export type Urgency = "en_retard" | "aujourdhui" | "bientot" | "planifiee" | "sans_date";

/** Tâche enrichie pour l'affichage : dates de référence et urgence calculées. */
export interface ScheduledTask extends DeliveryTask {
  /** Jour où la livraison est prévue (souhaitée, sinon limite). */
  readonly plannedDate: IsoDate | null;
  /** Jour à ne pas dépasser (limite, sinon souhaitée). */
  readonly limitDate: IsoDate | null;
  readonly urgency: Urgency;
}

/** Les deux vues de l'agenda. */
export type AgendaView = "aujourdhui" | "semaine";

/** Intervalle de dates inclusif, en dates calendaires suisses. */
export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

/** Facture déjà créée pour une commande. */
export interface InvoiceRef {
  readonly id: string;
  readonly number: string;
}
