import { addDays } from "../agenda/dates";
import type { DeliveryMode, IsoDate } from "../metafields/definitions";
import { addQuantity, setQuantity, toLines, type Quantities } from "./cart";
import type { B2bOption, CustomerOption, PaymentChoice, VariantGid } from "./types";

/** État du formulaire « Nouvelle commande » et ses transitions (logique pure, sans React). */

export interface PhoneOrderFormState {
  readonly customer: CustomerOption | null;
  /** Site B2B choisi ; `null` = commande au nom du client seul. */
  readonly b2bLocationId: string | null;
  readonly quantities: Quantities;
  readonly requestedDate: string;
  readonly deadline: string;
  /** Faux tant que la date limite suit la date souhaitée. */
  readonly deadlineEdited: boolean;
  readonly mode: DeliveryMode;
  readonly note: string;
  readonly payment: PaymentChoice;
}

export type FormAction =
  | { readonly type: "client"; readonly customer: CustomerOption | null }
  | { readonly type: "b2b"; readonly locationId: string | null }
  | { readonly type: "quantite"; readonly variantId: VariantGid; readonly quantity: number }
  | { readonly type: "ajouter"; readonly variantId: VariantGid; readonly delta: number }
  | { readonly type: "date_souhaitee"; readonly value: string }
  | { readonly type: "date_limite"; readonly value: string }
  | { readonly type: "mode"; readonly mode: DeliveryMode }
  | { readonly type: "note"; readonly value: string }
  | { readonly type: "paiement"; readonly payment: PaymentChoice }
  | { readonly type: "vider"; readonly today: IsoDate };

/** Par défaut : livraison demain, date limite identique, bon de commande. */
export function initialFormState(today: IsoDate): PhoneOrderFormState {
  const tomorrow = addDays(today, 1);
  return {
    customer: null,
    b2bLocationId: null,
    quantities: {},
    requestedDate: tomorrow,
    deadline: tomorrow,
    deadlineEdited: false,
    mode: "livraison",
    note: "",
    payment: "bon_de_commande",
  };
}

export function formReducer(state: PhoneOrderFormState, action: FormAction): PhoneOrderFormState {
  switch (action.type) {
    case "client":
      return { ...state, customer: action.customer, b2bLocationId: action.customer?.b2b[0]?.companyLocationId ?? null };
    case "b2b":
      return { ...state, b2bLocationId: action.locationId };
    case "quantite":
      return { ...state, quantities: setQuantity(state.quantities, action.variantId, action.quantity) };
    case "ajouter":
      return { ...state, quantities: addQuantity(state.quantities, action.variantId, action.delta) };
    case "date_souhaitee":
      return {
        ...state,
        requestedDate: action.value,
        deadline: state.deadlineEdited && state.deadline >= action.value ? state.deadline : action.value,
      };
    case "date_limite":
      return { ...state, deadline: action.value, deadlineEdited: action.value !== state.requestedDate };
    case "mode":
      return { ...state, mode: action.mode };
    case "note":
      return { ...state, note: action.value };
    case "paiement":
      return { ...state, payment: action.payment };
    case "vider":
      return initialFormState(action.today);
  }
}

export function selectedB2b(state: PhoneOrderFormState): B2bOption | null {
  if (state.customer === null || state.b2bLocationId === null) return null;
  return state.customer.b2b.find((option) => option.companyLocationId === state.b2bLocationId) ?? null;
}

/** Lignes en objets simples (sérialisables en JSON pour l'envoi). */
function jsonLines(state: PhoneOrderFormState) {
  return toLines(state.quantities).map((line) => ({ variantId: String(line.variantId), quantity: line.quantity }));
}

function purchaser(option: B2bOption | null) {
  return option === null
    ? null
    : { companyId: option.companyId, companyContactId: option.companyContactId, companyLocationId: option.companyLocationId };
}

/** Corps JSON envoyé au serveur pour « Créer la commande » (revalidé côté serveur). */
export function toSubmission(state: PhoneOrderFormState, idempotencyKey: string) {
  return {
    intent: "creer",
    idempotencyKey,
    customerId: state.customer?.id ?? "",
    b2b: purchaser(selectedB2b(state)),
    lines: jsonLines(state),
    requestedDate: state.requestedDate,
    deadline: state.deadline,
    mode: state.mode,
    note: state.note,
    payment: state.payment,
  };
}

/** Corps JSON du calcul des prix B2B, ou `null` s'il n'y a rien à calculer. */
export function toPriceRequest(state: PhoneOrderFormState) {
  const b2b = purchaser(selectedB2b(state));
  const lines = jsonLines(state);
  if (state.customer === null || b2b === null || lines.length === 0) return null;
  return { intent: "calculer", customerId: state.customer.id, b2b, lines };
}
