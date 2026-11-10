import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { getInvoice } from "./invoices.server";
import { interpretInvoiceStatus, todayInZurich } from "./invoice-status";
import type { CleanupIssueCode } from "./repository-types";
import { manualStepsFor, notDraftSteps } from "./trial-manual-steps";
import type { TrialContext } from "./trial-types";

/**
 * Étape 7 : effacer ce que l'essai a créé dans AbaNinja, au mieux et sans rien supposer.
 * La facture d'abord (le client ne peut pas être supprimé tant qu'une facture l'utilise).
 * Elle n'est supprimée que si AbaNinja la déclare « brouillon » juste avant, et la suppression
 * n'est annoncée que si une relecture la confirme. Un « introuvable » à la suppression ne prouve rien.
 */

export interface TrialLeftovers {
  readonly invoiceUuid: string | null;
  readonly companyUuid: string | null;
}

export interface CleanupOutcome {
  /** ok = tout est confirmé effacé ; saute = on n'y a pas touché ; incomplet = échec ou suppression non confirmée. */
  readonly result: "ok" | "saute" | "incomplet";
  readonly message: string;
  /** Instructions pour le propriétaire, vides si tout est effacé. */
  readonly manualSteps: readonly string[];
  readonly issue: CleanupIssueCode | null;
}

type InvoiceVerdict =
  | { readonly kind: "supprimee" }
  | { readonly kind: "non_brouillon"; readonly steps: readonly string[] }
  | { readonly kind: "echec"; readonly message: string };

const STATE_WORDS: Readonly<Record<string, string>> = {
  envoyee: "envoyée",
  payee: "payée",
  partiellement_payee: "partiellement payée",
  en_retard: "en retard",
  annulee: "annulée",
  inconnu: "inconnu",
};

/** AbaNinja ne documente pas l'archivage : on accepte ces mots comme preuve que la facture a disparu. */
const GONE_STATUSES: ReadonlySet<string> = new Set(["archived", "deleted"]);

async function confirmInvoiceGone(ctx: TrialContext, uuid: string): Promise<boolean> {
  const after = await getInvoice(ctx.config, uuid, ctx.call);
  if (!after.ok) return after.error.status === 404 || after.error.code === "introuvable";
  return GONE_STATUSES.has(after.value.status) || interpretInvoiceStatus(after.value, todayInZurich(ctx.now)) === "annulee";
}

async function removeInvoice(ctx: TrialContext, uuid: string): Promise<InvoiceVerdict> {
  const before = await getInvoice(ctx.config, uuid, ctx.call);
  if (!before.ok) return { kind: "echec", message: "La facture d’essai n’a pas pu être relue avant sa suppression : on n’y a pas touché." };
  const state = interpretInvoiceStatus(before.value, todayInZurich(ctx.now));
  if (state !== "brouillon") {
    return { kind: "non_brouillon", steps: notDraftSteps(STATE_WORDS[state] ?? "inconnu", before.value.systemInvoiceNumber) };
  }
  const deleted = await deleteInvoice(ctx.config, uuid, ctx.call);
  if (!deleted.ok) return { kind: "echec", message: "La facture d’essai n’a pas pu être supprimée. Elle reste en brouillon dans AbaNinja, sans aucun envoi à un client." };
  return (await confirmInvoiceGone(ctx, uuid))
    ? { kind: "supprimee" }
    : { kind: "echec", message: "La suppression de la facture d’essai n’est pas confirmée : AbaNinja la montre encore. Rien n’a été envoyé à un client." };
}

async function removeCompany(ctx: TrialContext, uuid: string, invoiceAlsoDeleted: boolean): Promise<CleanupOutcome> {
  const company = await deleteCompany(ctx.config, uuid, ctx.call);
  if (company.ok) {
    const what = invoiceAlsoDeleted ? "La facture et le client d’essai ont été supprimés d’AbaNinja." : "Le client d’essai a été supprimé d’AbaNinja.";
    return { result: "ok", message: what, manualSteps: [], issue: null };
  }
  const detail =
    company.error.status === 409
      ? "il est encore lié à un document"
      : company.error.status === 404 || company.error.code === "introuvable"
        ? "sa suppression n’est pas confirmée (AbaNinja ne l’a pas trouvé)"
        : "il n’a pas pu être supprimé";
  const subject = invoiceAlsoDeleted ? "La facture est supprimée, mais le client d’essai reste" : "Le client d’essai reste";
  const message = `${subject} dans AbaNinja : ${detail}.`;
  return { result: "incomplet", message, manualSteps: manualStepsFor(ctx.reference, { invoice: false, company: true }), issue: "nettoyage_incomplet" };
}

export async function cleanUpTrial(ctx: TrialContext, leftovers: TrialLeftovers): Promise<CleanupOutcome> {
  const hasCompany = leftovers.companyUuid !== null;
  if (leftovers.invoiceUuid !== null) {
    const verdict = await removeInvoice(ctx, leftovers.invoiceUuid);
    if (verdict.kind === "non_brouillon") {
      return { result: "saute", message: "La facture n’est pas un brouillon : rien n’a été supprimé.", manualSteps: verdict.steps, issue: "non_brouillon" };
    }
    if (verdict.kind === "echec") {
      return { result: "incomplet", message: verdict.message, manualSteps: manualStepsFor(ctx.reference, { invoice: true, company: hasCompany }), issue: "nettoyage_incomplet" };
    }
  }
  if (leftovers.companyUuid === null) {
    return { result: "ok", message: "La facture d’essai a été supprimée d’AbaNinja (vérifié : elle n’existe plus).", manualSteps: [], issue: null };
  }
  return removeCompany(ctx, leftovers.companyUuid, leftovers.invoiceUuid !== null);
}
