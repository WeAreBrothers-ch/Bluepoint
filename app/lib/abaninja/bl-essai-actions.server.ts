import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { convertTrialDeliveryNote } from "./bl-essai-convert.server";
import { createTrialDeliveryNote } from "./bl-essai-create.server";
import { eraseTrialDocuments } from "./bl-essai-erase.server";
import { parseDeliveryNoteTrialForm, readTrialDocuments } from "./bl-essai-form";
import { FICTITIOUS_ORDERS_QUERY, toOrderOption, type FictitiousOrders, type FictitiousOrdersData } from "./bl-essai-order";
import type { DeliveryNoteTrialOutcome } from "./bl-essai-types";
import { readAbaNinjaConfig } from "./config.server";
import { frenchTypography } from "./trial-typography";

/** Essai « bon de livraison → facture » : ce que font les trois boutons de la page, et la liste des commandes fictives. */

export interface DeliveryNoteTrialActionOutcome {
  readonly result: DeliveryNoteTrialOutcome;
  readonly status: number;
}

const NOT_UNDERSTOOD = "La demande n’a pas été comprise. Rechargez la page et réessayez.";
const UNEXPECTED = "Un problème inattendu a interrompu l’essai. Regardez dans AbaNinja ce qui a été créé (référence BP-ESSAI-BL-…) avant de réessayer.";

/** Espaces insécables de la typographie française, appliqués une fois à tout ce que la page affiche. */
function typeset(outcome: DeliveryNoteTrialOutcome): DeliveryNoteTrialOutcome {
  return { ...outcome, heading: frenchTypography(outcome.heading), details: outcome.details.map(frenchTypography) };
}

function stop(heading: string, status: number, formData: FormData): DeliveryNoteTrialActionOutcome {
  const documents = readTrialDocuments(Object.fromEntries(formData.entries()));
  return { result: typeset({ tone: "critical", heading, details: [], documents }), status };
}

export async function runDeliveryNoteTrialAction(
  admin: AdminApiContext,
  shop: string,
  formData: FormData,
  now: Date = new Date(),
): Promise<DeliveryNoteTrialActionOutcome> {
  const form = parseDeliveryNoteTrialForm(formData);
  if (form.kind === "refuse") return stop(NOT_UNDERSTOOD, 400, formData);
  const config = readAbaNinjaConfig();
  if (!config.ok) return stop(config.error.message, 409, formData);
  try {
    const result =
      form.kind === "creer"
        ? await createTrialDeliveryNote(admin, config.value, form.orderId, now)
        : form.kind === "facturer"
          ? await convertTrialDeliveryNote(config.value, form.documents, now)
          : await eraseTrialDocuments(config.value, form.documents, now);
    return { result: typeset(result), status: 200 };
  } catch (error) {
    logError("Essai bon de livraison : erreur inattendue", error, { shop, step: form.kind });
    return stop(UNEXPECTED, 500, formData);
  }
}

/** Commandes étiquetées « fictif », les plus récentes d'abord. Lecture seule. */
export async function loadFictitiousOrders(admin: AdminApiContext, shop: string): Promise<FictitiousOrders> {
  const result = await runAdminGraphql<FictitiousOrdersData>(admin, FICTITIOUS_ORDERS_QUERY);
  if (!result.ok) {
    logError("Essai bon de livraison : commandes fictives illisibles", result.error, { shop });
    return { available: false, options: [] };
  }
  return { available: true, options: result.value.orders.nodes.map(toOrderOption) };
}
