import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

/**
 * Cadre « BluePoint » de la page de commande Shopify : l'essentiel en quatre lignes
 * (quand et comment, paiement, facture, prochaine étape) et le bouton vers l'agenda.
 * Les données viennent de l'app (/api/resume-commande), avec les mêmes mots que l'agenda.
 */

const APP_URL = "https://bluepoint-gestion.vercel.app";

export default async () => {
  render(<Extension />, document.body);
};

async function fetchSummary(orderId) {
  const token = await shopify.auth.idToken();
  const response = await fetch(`${APP_URL}/api/resume-commande?id=${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Réponse ${response.status}`);
  return response.json();
}

function Summary({ summary }) {
  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="block" gap="small-200">
        <s-badge tone={summary.headlineTone} size="large">
          {summary.headline}
        </s-badge>
        <s-stack direction="inline" gap="small-200">
          <s-badge>{summary.mode}</s-badge>
          {summary.payment ? <s-badge tone={summary.payment.tone}>{summary.payment.label}</s-badge> : null}
        </s-stack>
      </s-stack>
      {summary.invoice ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{`Facture ${summary.invoice.number}`}</s-text>
          <s-link href={summary.invoice.viewUrl} target="_blank">
            Voir / imprimer
          </s-link>
        </s-stack>
      ) : (
        <s-text color="subdued">Pas encore de facture.</s-text>
      )}
      <s-text>{summary.nextStep}</s-text>
      <s-stack direction="inline" gap="small-200">
        <s-button href="app:app" variant="primary">
          Ouvrir l’agenda
        </s-button>
        {summary.invoice ? <s-button href="app:app/factures">Factures</s-button> : null}
      </s-stack>
    </s-stack>
  );
}

function Extension() {
  const orderId = shopify.data.selected?.[0]?.id ?? null;
  const [state, setState] = useState({ status: "chargement" });

  useEffect(() => {
    if (orderId === null) return undefined;
    let active = true;
    fetchSummary(orderId)
      .then((summary) => active && setState({ status: "pret", summary }))
      .catch(() => active && setState({ status: "erreur" }));
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <s-admin-block heading="BluePoint">
      {state.status === "chargement" ? <s-text color="subdued">Chargement…</s-text> : null}
      {state.status === "erreur" ? (
        <s-text tone="critical">Les informations BluePoint n’ont pas pu être chargées. Rechargez la page.</s-text>
      ) : null}
      {state.status === "pret" ? <Summary summary={state.summary} /> : null}
    </s-admin-block>
  );
}
