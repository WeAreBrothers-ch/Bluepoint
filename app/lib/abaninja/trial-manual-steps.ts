import { TRIAL_CLIENT_NAME } from "./trial-fixtures";

/** Les consignes données au propriétaire quand l'essai ne peut pas tout effacer lui-même. */

export interface Leftovers {
  readonly invoice: boolean;
  readonly company: boolean;
}

export function manualStepsFor(reference: string, leftovers: Leftovers): string[] {
  const steps: string[] = [];
  if (leftovers.invoice) {
    steps.push(`Dans AbaNinja, cherchez la facture de référence « ${reference} » (1 CHF). Si elle est encore en brouillon, supprimez-la.`);
  }
  if (leftovers.company) {
    steps.push(`Ensuite, supprimez le client « ${TRIAL_CLIENT_NAME} ».`);
  }
  return steps;
}

/** La facture relue n'est pas un brouillon : on n'y touche pas. */
export function notDraftSteps(stateText: string, invoiceNumber: string | null): string[] {
  const number = invoiceNumber === null || invoiceNumber === "" ? "numéro inconnu" : `n° ${invoiceNumber}`;
  return [
    `Cette facture n’est pas un brouillon (état ${stateText}, ${number}) : ne la supprimez pas vous-même, voyez avec votre comptable.`,
    `Le client « ${TRIAL_CLIENT_NAME} » est lié à cette facture : ne le supprimez pas non plus.`,
  ];
}

/** Création incertaine : la facture et/ou le client existent peut-être. */
export function uncertainSteps(reference: string, created: { readonly companyUuid: string | null; readonly clientMaybeCreated: boolean }): string[] {
  if (created.clientMaybeCreated) {
    return [`Dans AbaNinja, cherchez le client « ${TRIAL_CLIENT_NAME} » : s’il existe, supprimez-le.`];
  }
  const invoice = `Dans AbaNinja, cherchez la facture de référence « ${reference} ». Si elle existe, supprimez-la.`;
  return created.companyUuid === null ? [invoice] : [invoice, `Ensuite, supprimez le client « ${TRIAL_CLIENT_NAME} ».`];
}
