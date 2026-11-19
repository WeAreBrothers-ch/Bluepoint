import { logError } from "../core/logger.server";
import type { AbaNinjaConfig } from "./config.server";
import { deleteCompany } from "./invoice-cleanup.server";
import { dropProClientReservation, forgetProClient, type AbaNinjaTestClient } from "./vente-client-pro-repository.server";
import { STALE_MS, type RowOutcome } from "./vente-essai-resume";
import { PRO_TEST_CLIENT_NAME } from "./vente-positions";

/**
 * Dernière étape de « Effacer les factures d'essai » : le client pro fictif part une seule fois, quand toutes les
 * pièces d'essai sont effacées (aucune ne s'en sert plus). Le prochain essai d'un pro en recrée un.
 */

const NAME = `« ${PRO_TEST_CLIENT_NAME} »`;

function kept(text: string): RowOutcome {
  return { kind: "gardee", text };
}

/**
 * Sans client gardé : « à vérifier » ou resté en plan, l'app l'oublie et Eliott vérifie. La base tranche au moment
 * même : une création en cours (ou finie entre-temps) n'est jamais oubliée, et rien n'est alors à faire à la main.
 */
async function withoutIds(client: AbaNinjaTestClient, now: Date): Promise<RowOutcome> {
  const dropped = await dropProClientReservation(client.shop, new Date(now.getTime() - STALE_MS));
  if (!dropped.ok) {
    logError("Client pro fictif à vérifier non oublié", dropped.error, { shop: client.shop });
    return kept("L’app n’a pas pu oublier le client pro fictif à vérifier : réessayez.");
  }
  if (!dropped.value) return kept("Le client pro fictif est en train d’être créé : réessayez dans deux minutes.");
  return { kind: "a_la_main", text: `Cherchez dans AbaNinja un client ${NAME} et supprimez-le s’il existe.` };
}

/** L'app ne se sert plus de ce client ; `done` est dit si elle a bien pu l'oublier. */
async function forget(client: AbaNinjaTestClient, companyUuid: string, done: RowOutcome): Promise<RowOutcome> {
  const forgotten = await forgetProClient(client.shop, companyUuid);
  if (forgotten.ok) return done;
  logError("Client pro fictif effacé dans AbaNinja mais pas oublié", forgotten.error, { shop: client.shop });
  return kept("Client pro fictif effacé dans AbaNinja, mais l’app n’a pas pu l’oublier : réessayez.");
}

/** null : pas de client pro fictif. `othersErased` : toutes les autres pièces d'essai sont parties. */
export async function eraseProTestClient(
  config: AbaNinjaConfig,
  client: AbaNinjaTestClient | null,
  othersErased: boolean,
  now: Date,
): Promise<RowOutcome | null> {
  if (client === null) return null;
  const { companyUuid } = client;
  if (companyUuid === null) return withoutIds(client, now);
  if (!othersErased) return kept("Le client pro fictif reste : une pièce d’essai est encore dans AbaNinja. Il partira au prochain effacement, une fois tout le reste effacé.");
  const removed = await deleteCompany(config, companyUuid);
  if (removed.ok || removed.error.code === "introuvable") return forget(client, companyUuid, { kind: "effacee", text: "Client pro fictif effacé." });
  if (removed.error.status === 409) {
    const why = "une pièce s’en sert encore (une facture annulée, ou faite à la main avec ce client)";
    const then = "Il continue de servir aux prochains essais. Pour qu’il parte, supprimez cette pièce dans AbaNinja, puis effacez à nouveau.";
    return { kind: "a_la_main", text: `Le client pro fictif ${NAME} reste dans AbaNinja : ${why}. ${then}` };
  }
  if (removed.error.retryable) return kept("AbaNinja n’a pas répondu pour le client pro fictif. Réessayez dans un instant.");
  return forget(client, companyUuid, { kind: "a_la_main", text: `Le client pro fictif ${NAME} reste dans AbaNinja : supprimez-le à la main.` });
}
