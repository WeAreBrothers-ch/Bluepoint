import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { batchMessage, runBatch, type Outcome } from "./batch";
import { loadComparison, type Comparison } from "./comparison.server";
import { parseAbaNinjaClientsForm, type ClientsAbaNinjaIntent } from "./form";
import { findStatus, type CardStatus } from "./match";
import { operationContext, type OperationContext } from "./context.server";
import { createCard, finishPro, linkCard } from "./operations.server";
import { addRefusal, setIgnored } from "./shopify-write.server";

/**
 * Boutons de la page « Clients AbaNinja ». Chaque bouton relit AbaNinja et la boutique, puis vérifie que la
 * situation est toujours celle affichée avant d'écrire : un double clic ou une page ancienne ne crée rien en double.
 */

export interface ClientsAbaNinjaResult {
  readonly ok: boolean;
  readonly intent: string | null;
  readonly fiche: string | null;
  readonly message: string;
}

const RETRY = "Ça n’a pas marché. Rechargez la page, puis réessayez.";
const STALE = "La situation a changé depuis l’affichage de la page. Rechargez-la, puis réessayez.";

type BatchIntent = Extract<ClientsAbaNinjaIntent, { intent: "relier_tous" | "creer_tous" }>;
type SingleIntent = Exclude<ClientsAbaNinjaIntent, BatchIntent>;

function isBatch(request: ClientsAbaNinjaIntent): request is BatchIntent {
  return request.intent === "relier_tous" || request.intent === "creer_tous";
}

function candidateClients(status: CardStatus) {
  if (status.kind === "meme_email") return [status.candidate.client];
  if (status.kind === "a_verifier") return status.candidates.map((candidate) => candidate.client);
  return [];
}

async function onCard(context: OperationContext, comparison: Comparison, request: SingleIntent): Promise<Outcome> {
  const status = findStatus(comparison.statuses, request.fiche);
  if (status === undefined) return { ok: false, message: STALE };
  const { card } = status;
  if (status.kind === "relie" && request.intent !== "remettre") {
    const unfinished = card.kind === "company" && !status.client.proReady && (request.intent === "relier" || request.intent === "creer");
    if (unfinished) return finishPro(context, card, status.client);
    return { ok: true, message: `C’était déjà fait\u202F: ${card.name} est relié à ${status.client.displayName}.` };
  }
  if (status.kind === "ignore" && status.auto) {
    return { ok: false, message: `${card.name} regroupe les ventes aux particuliers\u202F: cette fiche reste de côté.` };
  }
  const { side } = comparison;
  switch (request.intent) {
    case "ignorer": {
      const saved = await setIgnored(context.admin, side.shopId, [...side.ignored, card.uuid]);
      return saved.ok ? { ok: true, message: `${card.name} est mis de côté\u202F: il ne sera pas repris dans la boutique.` } : { ok: false, message: RETRY };
    }
    case "remettre": {
      const saved = await setIgnored(context.admin, side.shopId, side.ignored.filter((uuid) => uuid !== card.uuid));
      return saved.ok ? { ok: true, message: `${card.name} est de nouveau dans la liste.` } : { ok: false, message: RETRY };
    }
    case "creer":
      return status.kind === "absent" ? createCard(context, status) : { ok: false, message: STALE };
    case "relier":
    case "pas_lui": {
      const client = candidateClients(status).find((candidate) => candidate.customerId === request.client);
      if (client === undefined) return { ok: false, message: STALE };
      if (request.intent === "relier") return linkCard(context, card, client);
      const saved = await addRefusal(context.admin, client, card.uuid);
      return saved.ok ? { ok: true, message: `C’est noté\u202F: ${client.displayName} n’est pas ${card.name}.` } : { ok: false, message: RETRY };
    }
  }
}

async function onAll(context: OperationContext, comparison: Comparison, intent: BatchIntent["intent"]): Promise<Outcome> {
  if (intent === "relier_tous") {
    const items = comparison.statuses.filter((status): status is Extract<CardStatus, { kind: "meme_email" }> => status.kind === "meme_email");
    const report = await runBatch(items, (item) => item.card.name, (item) => linkCard(context, item.card, item.candidate.client));
    return { ok: report.failures.length === 0, message: batchMessage(report, "reliée") };
  }
  const items = comparison.statuses.filter(
    (status): status is Extract<CardStatus, { kind: "absent" }> => status.kind === "absent" && status.email !== null,
  );
  const report = await runBatch(items, (item) => item.card.name, (item) => createCard(context, item));
  return { ok: report.failures.length === 0, message: batchMessage(report, "créée") };
}

export async function handleAbaNinjaClientsAction(
  admin: AdminApiContext,
  shop: string,
  form: { get(name: string): FormDataEntryValue | null },
): Promise<ClientsAbaNinjaResult> {
  const request = parseAbaNinjaClientsForm(form);
  if (request === null) return { ok: false, intent: null, fiche: null, message: RETRY };
  const fiche = "fiche" in request ? request.fiche : null;
  try {
    const comparison = await loadComparison(admin);
    if (!comparison.ok) return { ok: false, intent: request.intent, fiche, message: comparison.error.message };
    const context: OperationContext = operationContext(admin, shop, comparison.value.side);
    const outcome = isBatch(request)
      ? await onAll(context, comparison.value, request.intent)
      : await onCard(context, comparison.value, request);
    logInfo("Clients AbaNinja : bouton", { intent: request.intent, ok: outcome.ok });
    return { ok: outcome.ok, intent: request.intent, fiche, message: outcome.message };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Clients AbaNinja : bouton impossible", error, { intent: request.intent });
    return { ok: false, intent: request.intent, fiche, message: RETRY };
  }
}
