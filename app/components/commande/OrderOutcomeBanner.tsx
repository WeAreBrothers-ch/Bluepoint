import type { PhoneOrderOutcome } from "../../lib/commande/outcome";
import { gidToNumericId, parseGid } from "../../lib/shopify/ids";

/** Résultat de « Créer la commande » : liens vers Shopify et l'agenda, ou erreur à corriger. */

const ADMIN_PATHS = { Order: "orders", DraftOrder: "draft_orders" } as const;

/** Lien App Bridge vers la fiche dans l'admin Shopify (la liste si l'identifiant est illisible). */
function adminLink(resource: keyof typeof ADMIN_PATHS, gid: string): string {
  const parsed = parseGid(gid, resource);
  const base = `shopify://admin/${ADMIN_PATHS[resource]}`;
  return parsed === null ? base : `${base}/${gidToNumericId(parsed)}`;
}

export function OrderOutcomeBanner({ outcome }: { readonly outcome: PhoneOrderOutcome }) {
  switch (outcome.kind) {
    case "commande":
      return (
        <s-banner tone="success" heading={`Commande ${outcome.orderName} créée`}>
          <s-stack direction="block" gap="small-200">
            <s-text>
              {outcome.paymentPending
                ? "Bon de commande : paiement attendu selon les conditions nettes."
                : "Commande enregistrée comme payée."}
              {outcome.replayed ? " Elle avait déjà été créée : aucun doublon." : ""}
            </s-text>
            {outcome.warnings.map((warning) => (
              <s-text key={warning}>{warning}</s-text>
            ))}
            <s-stack direction="inline" gap="small-200">
              <s-button href={adminLink("Order", outcome.orderId)} variant="primary">
                Ouvrir la commande dans Shopify
              </s-button>
              <s-button href="/app">Voir l’agenda</s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      );
    case "brouillon":
      return (
        <s-banner tone="warning" heading={`Commande provisoire ${outcome.draftName} créée, pas encore terminée`}>
          <s-stack direction="block" gap="small-200">
            <s-text>{outcome.message}</s-text>
            <s-stack direction="inline">
              <s-button href={adminLink("DraftOrder", outcome.draftOrderId)}>Ouvrir la commande provisoire</s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      );
    case "en_cours":
      return <s-banner tone="info" heading={outcome.message} />;
    case "invalide":
    case "erreur":
      return <s-banner tone="critical" heading={outcome.message} />;
  }
}
