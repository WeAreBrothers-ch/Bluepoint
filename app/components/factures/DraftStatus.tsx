import type { InvoiceDraftsResult } from "../../lib/factures/draft.server";

/** États communs des fenêtres d'envoi tant que le message n'est pas prêt. */

interface DraftStatusProps {
  readonly data: InvoiceDraftsResult | undefined;
  /** Message affiché quand le brouillon est prêt mais que ce canal n'est pas possible. */
  readonly unavailable: string;
}

export function DraftStatus({ data, unavailable }: DraftStatusProps) {
  if (data === undefined) {
    return (
      <s-stack direction="inline" justifyContent="center" padding="large">
        <s-spinner accessibilityLabel="Préparation du message" />
      </s-stack>
    );
  }
  return <s-banner tone={data.ok ? "warning" : "critical"} heading={data.ok ? unavailable : data.message} />;
}

/** Boutons de la fenêtre quand rien ne peut encore être envoyé. */
export function ModalButtons({ modalId, primary }: { readonly modalId: string; readonly primary: string }) {
  return (
    <>
      <s-button slot="primary-action" variant="primary" disabled>
        {primary}
      </s-button>
      <s-button slot="secondary-actions" commandFor={modalId} command="--hide">
        Annuler
      </s-button>
    </>
  );
}
