import { useFetcher } from "react-router";
import type { OrderDetailResult } from "../../lib/agenda/detail/load.server";
import { gidToNumericId, type OrderGid } from "../../lib/shopify/ids";
import { OrderDetailBody } from "./OrderDetailBody";

/**
 * Fenêtre « détail de la commande ».
 * Le chargement part du clic sur le bouton ou le numéro (React 18 ne relaie pas les
 * événements propres aux composants Polaris comme `show`), puis à chaque réouverture.
 */

type DetailFetcher = ReturnType<typeof useFetcher<OrderDetailResult>>;

export interface OrderDetailControls {
  readonly modalId: string;
  readonly numericId: string;
  readonly fetcher: DetailFetcher;
  /** À brancher sur le clic de tout élément qui ouvre la fenêtre. */
  readonly load: () => void;
}

export function useOrderDetail(orderId: OrderGid): OrderDetailControls {
  const numericId = gidToNumericId(orderId);
  const modalId = `detail-commande-${numericId}`;
  const fetcher = useFetcher<OrderDetailResult>({ key: modalId });
  const load = () => {
    if (fetcher.state === "idle") void fetcher.load(`/app/agenda/commande/${numericId}`);
  };
  return { modalId, numericId, fetcher, load };
}

function Content({ fetcher }: { readonly fetcher: DetailFetcher }) {
  const data = fetcher.data;
  if (data === undefined) {
    return (
      <s-stack direction="inline" justifyContent="center" padding="large">
        <s-spinner accessibilityLabel="Chargement du détail" />
      </s-stack>
    );
  }
  if (!data.ok) return <s-banner tone="critical" heading={data.message} />;
  return <OrderDetailBody detail={data.detail} />;
}

interface OrderDetailModalProps {
  readonly controls: OrderDetailControls;
  readonly name: string;
}

export function OrderDetailModal({ controls, name }: OrderDetailModalProps) {
  return (
    <s-modal id={controls.modalId} heading={`Commande ${name}`}>
      <Content fetcher={controls.fetcher} />
      <s-button slot="primary-action" commandFor={controls.modalId} command="--hide">
        Fermer
      </s-button>
      <s-button slot="secondary-actions" href={`shopify://admin/orders/${controls.numericId}`} target="_blank">
        Ouvrir dans Shopify
      </s-button>
    </s-modal>
  );
}
