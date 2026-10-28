import type { InvoiceShortcuts } from "../factures/list-item";
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

/** Conditions de paiement de la commande (bon de commande « à 30 jours », paiement à la livraison…). */
export interface PaymentTermsInfo {
  /** `paymentTermsType` de Shopify : NET, FULFILLMENT, RECEIPT, FIXED… */
  readonly type: string;
  readonly dueInDays: number | null;
}

/** Un vin de la commande et la quantité encore commandée. */
export interface OrderItem {
  readonly name: string;
  readonly quantity: number;
}

export interface DeliveryTask {
  readonly orderId: OrderGid;
  /** Numéro lisible de la commande, ex. « #1042 ». */
  readonly name: string;
  readonly customerName: string;
  /** Raison sociale du client professionnel (commande B2B ou adresse avec société). */
  readonly company: string | null;
  /** Client professionnel (restaurant, caviste…) ou particulier. */
  readonly isPro: boolean;
  /** Rue et numéro de l'adresse de livraison (avec le complément éventuel). */
  readonly street: string | null;
  readonly zip: string | null;
  readonly city: string | null;
  /** Téléphone de l'adresse de livraison, sinon celui du client. */
  readonly phone: string | null;
  /** Remarque saisie à la commande (code de porte, horaires…), jamais vue par le client. */
  readonly note: string | null;
  /** Vins à livrer (10 premières lignes de la commande). */
  readonly items: readonly OrderItem[];
  /** Total actuel de la commande en centimes, `null` si illisible ou pas en CHF. */
  readonly totalCents: number | null;
  readonly requestedDate: IsoDate | null;
  readonly deadline: IsoDate | null;
  readonly dateSource: DateSource;
  readonly mode: DeliveryMode | null;
  readonly status: DeliveryStatus;
  /** Jour (heure suisse) de la dernière expédition réussie, `null` si rien n'est encore parti. */
  readonly deliveredOn: IsoDate | null;
  readonly financialStatus: FinancialStatus | null;
  /** Lues à part (autorisation distincte) : `null` si aucune ou illisibles. */
  readonly paymentTerms: PaymentTermsInfo | null;
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

/** Semaine affichée et liens vers les semaines voisines (`?semaine=` du lundi). */
export interface WeekNavigation {
  readonly week: DateRange;
  readonly isCurrentWeek: boolean;
  readonly previousStart: IsoDate;
  readonly nextStart: IsoDate;
}

/** Facture déjà créée pour une commande : de quoi la voir et l'envoyer depuis l'agenda. */
export type InvoiceRef = InvoiceShortcuts;
