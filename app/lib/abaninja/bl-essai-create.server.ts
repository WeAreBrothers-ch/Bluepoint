import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logInfo } from "../core/logger.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { createAddress } from "./addresses.server";
import { chf, readTrialNote, statusWord, swissDate } from "./bl-essai-note.server";
import { TRIAL_ORDER_QUERY, type TrialOrderData } from "./bl-essai-order";
import { planDeliveryNoteTrial, type DeliveryNoteTrialPlan } from "./bl-essai-plan";
import type { DeliveryNoteTrialOutcome } from "./bl-essai-types";
import type { AbaNinjaConfig } from "./config.server";
import { createDeliveryNote, listDeliveryNoteActionNames } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany } from "./invoice-cleanup.server";

/** Étape 1 de l'essai : le client d'essai puis le bon de livraison, en brouillon. Rien n'est envoyé. */

function refused(heading: string, details: readonly string[] = []): DeliveryNoteTrialOutcome {
  return { tone: "critical", heading, details, documents: null };
}

/** Le bon n'a pas été créé : on retire le client d'essai pour ne rien laisser derrière. */
async function noteFailed(config: AbaNinjaConfig, companyUuid: string, plan: DeliveryNoteTrialPlan, error: AbaNinjaError) {
  logInfo("Essai bon de livraison : création du bon refusée", { status: error.status ?? null, code: error.code });
  const removed = await deleteCompany(config, companyUuid);
  const leftover = removed.ok
    ? "Le client d’essai a été retiré d’AbaNinja : il ne reste rien."
    : `Le client d’essai « ${plan.clientName} » reste peut-être dans AbaNinja (et un bon de référence ${plan.reference}) : supprimez-les à la main.`;
  return refused("AbaNinja n’a pas créé le bon de livraison", [error.message, leftover]);
}

function convertHint(actions: readonly string[] | null): string {
  if (actions === null) return "AbaNinja n’a pas dit quelles actions il permet sur ce bon.";
  return actions.includes("convertDNI")
    ? "AbaNinja accepte de transformer ce bon en facture tel quel : vous pouvez passer à l’étape 2."
    : "AbaNinja ne propose pas de transformer ce bon en facture tant qu’il est en brouillon : l’étape 2 risque d’être refusée.";
}

async function describeCreated(config: AbaNinjaConfig, noteUuid: string, plan: DeliveryNoteTrialPlan): Promise<DeliveryNoteTrialOutcome> {
  const [note, actions] = await Promise.all([readTrialNote(config, noteUuid), listDeliveryNoteActionNames(config, noteUuid)]);
  const allowed = actions.ok ? actions.value : null;
  logInfo("Essai bon de livraison : bon créé", { status: note.ok ? note.value.status : null, actions: allowed?.join(",") ?? null });
  const state = note.ok
    ? `Dans AbaNinja, le bon est « ${statusWord(note.value.status)} »${note.value.number === null ? ", sans numéro pour l’instant" : `, n° ${note.value.number}`}.`
    : "Le bon est créé, mais il n’a pas pu être relu tout de suite.";
  return {
    tone: "success",
    heading: "Bon de livraison créé dans AbaNinja",
    details: [
      `Client d’essai : ${plan.clientName}.`,
      `${plan.note.positions.length} vins, ${chf(plan.totalChf)} TTC, livraison prévue le ${swissDate(plan.note.deliveryDate)}.`,
      state,
      `Pour le voir : AbaNinja, menu « Bulletins de livraison », référence ${plan.reference}.`,
      convertHint(allowed),
    ],
    documents: { noteUuid, invoiceUuid: null, reference: plan.reference },
  };
}

export async function createTrialDeliveryNote(
  admin: AdminApiContext,
  config: AbaNinjaConfig,
  orderId: string,
  now: Date,
): Promise<DeliveryNoteTrialOutcome> {
  const read = await runAdminGraphql<TrialOrderData>(admin, TRIAL_ORDER_QUERY, { id: orderId });
  if (!read.ok) return refused("Shopify n’a pas répondu", ["La commande n’a pas pu être lue. Réessayez dans un instant."]);
  if (read.value.order === null) return refused("Cette commande n’existe plus dans Shopify");
  const plan = planDeliveryNoteTrial(read.value.order, now);
  if (!plan.ok) return refused("L’essai ne peut pas partir de cette commande", [plan.error.message]);
  const receiver = await createAddress(config, plan.value.address, { force: true });
  if (!receiver.ok) {
    return refused("AbaNinja n’a pas créé le client d’essai", [
      receiver.error.message,
      `Si un client « ${plan.value.clientName} » apparaît quand même dans AbaNinja, supprimez-le.`,
    ]);
  }
  if (!("companyUuid" in receiver.value)) return refused("AbaNinja a créé une personne au lieu d’une entreprise : l’essai s’arrête.");
  const created = await createDeliveryNote(config, { ...plan.value.note, receiver: receiver.value });
  if (!created.ok) return noteFailed(config, receiver.value.companyUuid, plan.value, created.error);
  if (created.value.kind === "incertain") {
    return refused("Le résultat est incertain", [
      "AbaNinja a mis la création du bon en attente. Rien n’a été envoyé à personne.",
      `Regardez dans « Bulletins de livraison » si un bon ${plan.value.reference} apparaît, et supprimez-le avec le client « ${plan.value.clientName} ».`,
    ]);
  }
  return describeCreated(config, created.value.uuid, plan.value);
}
