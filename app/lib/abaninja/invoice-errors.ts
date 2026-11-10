import { AbaNinjaError } from "./errors";

/**
 * Erreur de création de facture. `outcome` dit si on peut recommencer :
 * - "refusee" : AbaNinja a clairement refusé (ou rien n'est parti), RIEN n'a été créé ;
 * - "incertaine" : la facture a peut-être été créée. L'appelant doit la chercher
 *   avant de recréer quoi que ce soit.
 */
export type CreateOutcome = "refusee" | "incertaine";

const UNCERTAIN_MESSAGE =
  "Résultat incertain : la facture a peut-être été créée dans AbaNinja. Vérifiez dans AbaNinja avant de la recréer.";

export class CreateInvoiceError extends AbaNinjaError {
  constructor(
    cause: AbaNinjaError,
    readonly outcome: CreateOutcome,
    readonly queueUuid?: string,
  ) {
    super(cause.code, {
      ...(cause.status === undefined ? {} : { status: cause.status }),
      cause,
      message: outcome === "incertaine" ? UNCERTAIN_MESSAGE : `La facture n'a pas été créée. ${cause.message}`,
    });
  }
}

/** Statuts qui prouvent qu'AbaNinja a rejeté la demande sans rien créer. */
const REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 409, 413, 422]);

/**
 * Seul un de ces statuts (ou une erreur locale avant envoi) prouve que rien n'a été créé.
 * Tout le reste est incertain : 408/425/429/499 et autres 4xx (la requête a pu être traitée
 * avant la coupure), 5xx, erreur réseau, délai dépassé, redirection, 202.
 */
export function classifyCreateFailure(error: AbaNinjaError): CreateOutcome {
  if (error.status === undefined) return error.code === "donnees_refusees" ? "refusee" : "incertaine";
  return REJECTION_STATUSES.has(error.status) ? "refusee" : "incertaine";
}
