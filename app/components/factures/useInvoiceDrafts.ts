import { useFetcher } from "react-router";
import type { InvoiceDraftsResult } from "../../lib/factures/draft.server";

/**
 * Brouillons d'envoi d'une facture, chargés au clic (et rechargés à chaque ouverture :
 * le lien WhatsApp signé et le récapitulatif restent à jour).
 */

export interface InvoiceDraftsControls {
  readonly data: InvoiceDraftsResult | undefined;
  readonly loading: boolean;
  readonly load: () => void;
}

export function useInvoiceDrafts(invoiceId: string): InvoiceDraftsControls {
  const fetcher = useFetcher<InvoiceDraftsResult>({ key: `brouillon-facture-${invoiceId}` });
  const load = () => {
    if (fetcher.state === "idle") void fetcher.load(`/app/factures/${invoiceId}/message`);
  };
  return { data: fetcher.state === "idle" ? fetcher.data : undefined, loading: fetcher.state !== "idle", load };
}

/** Ferme une fenêtre Polaris (`s-modal`) par son identifiant. */
export function hideModal(modalId: string): void {
  const modal = document.getElementById(modalId) as (HTMLElement & { hideOverlay?: () => void }) | null;
  modal?.hideOverlay?.();
}
