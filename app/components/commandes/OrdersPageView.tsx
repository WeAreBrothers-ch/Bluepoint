import { orderHref } from "../../lib/navigation";
import { TITRES } from "../../lib/titres";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { bottleCountText, modeLabel, type BadgeLabel } from "../../lib/agenda/labels";
import { ORDERS_TABS, ordersHref, type OrderListItem } from "../../lib/commandes/list";
import type { OrdersPageData } from "../../lib/commandes/list.server";
import { formatChf } from "../../lib/format/money";
import { gidToNumericId } from "../../lib/shopify";
import { ClientCard } from "../ClientCard";
import { ClientKindBadge, clientKind } from "../ClientKindBadge";
import { EmptyState } from "../EmptyState";
import { FILL } from "../fill";
import { GroupTitle } from "../GroupTitle";
import { PaymentBadges } from "../agenda/TaskBadges";

/** Page « Commandes » : retrouver une commande (client, numéro, état) et l'ouvrir dans l'app. */

function stateBadge(item: OrderListItem): BadgeLabel {
  if (item.cancelled) return { label: "Annulée", tone: "critical" };
  const { task } = item;
  if (task.status === "livree") return { label: "Livrée", tone: "success" };
  if (task.status === "expediee") return { label: "En route", tone: "info" };
  if (task.status === "partielle") return { label: "Livrée en partie", tone: "caution" };
  return task.urgency === "en_retard" ? { label: "En retard", tone: "critical" } : { label: "À livrer", tone: "neutral" };
}

export function OrderCard({ item, clientId = null }: { readonly item: OrderListItem; readonly clientId?: string | null }) {
  const { task } = item;
  const badge = stateBadge(item);
  const mode = modeLabel(task.mode);
  const bottles = task.items.reduce((sum, line) => sum + line.quantity, 0);
  const total = task.totalCents === null ? "" : ` · ${formatChf(task.totalCents)}`;
  const late = !item.cancelled && task.urgency === "en_retard" && task.status !== "livree";
  return (
    <ClientCard
      kind={clientKind(task.isPro)}
      header={
        <>
          <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {task.mode === null ? null : <s-icon type={mode.icon} />}
              <s-heading>{task.company ?? task.customerName}</s-heading>
            </s-stack>
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <ClientKindBadge isPro={task.isPro} {...(task.mode === null ? {} : { detail: mode.label })} />
              <s-badge tone={badge.tone}>{badge.label}</s-badge>
            </s-stack>
          </s-stack>
          <s-text color="subdued">{task.company === null ? `Commande ${task.name}` : `${task.customerName} · commande ${task.name}`}</s-text>
        </>
      }
    >
      <s-stack direction="block" gap="small-200">
        <s-text color="subdued">{item.orderedLabel}</s-text>
        <s-text type="strong" {...(late ? { tone: "critical" as const } : {})}>
          {item.deliveryLine}
        </s-text>
        {task.items.length === 0 ? null : (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text>{`${bottleCountText(bottles)}${total}`}</s-text>
            {item.cancelled ? null : <PaymentBadges task={task} />}
          </s-stack>
        )}
      </s-stack>
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} icon="order" href={clientId === null ? orderHref(gidToNumericId(task.orderId), "commandes") : orderHref(gidToNumericId(task.orderId), "client", clientId)}>
          Voir la commande
        </s-button>
      </s-grid>
    </ClientCard>
  );
}

export function OrdersPageView({ data }: { readonly data: OrdersPageData }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(data.term);
  const search = (event: FormEvent) => {
    event.preventDefault();
    void navigate(ordersHref(data.tab, term));
  };
  const searching = data.term !== "";
  const first = data.items.length === 0;

  return (
    <s-page heading={TITRES.commandes} inlineSize="base">
      <s-button slot="primary-action" variant="primary" icon="plus" href="/app/commande">
        Prendre une commande
      </s-button>
      <s-section>
        <s-stack direction="block" gap="base">
          <form onSubmit={search}>
            <s-stack direction="block" gap="small-200">
              <s-search-field
                label="Chercher une commande"
                placeholder="Nom du client, entreprise, ville ou numéro"
                value={term}
                onInput={(event) => setTerm(event.currentTarget.value)}
              />
              <s-grid gridTemplateColumns="minmax(0, 1fr)">
                <s-button {...FILL} type="submit" icon="search">
                  Chercher
                </s-button>
              </s-grid>
            </s-stack>
          </form>
          <s-grid gridTemplateColumns={`repeat(${ORDERS_TABS.length}, minmax(0, 1fr))`} gap="small-200">
            {ORDERS_TABS.map((tab) => (
              <s-button key={tab.id} {...FILL} href={ordersHref(tab.id, data.term)} variant="secondary" {...(tab.id === data.tab ? { icon: "check" as const } : {})}>
                {tab.label}
              </s-button>
            ))}
          </s-grid>
        </s-stack>
      </s-section>
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.loadError === null && first ? (
        <EmptyState
          heading={searching ? "Aucune commande trouvée" : "Aucune commande ici"}
          action={
            searching ? (
              <s-button href={ordersHref(data.tab, "")}>Effacer la recherche</s-button>
            ) : (
              <s-button href="/app/commande" variant="primary">
                Prendre une commande
              </s-button>
            )
          }
        >
          {searching
            ? `Rien ne correspond à « ${data.term} ». Essayez le nom de l’entreprise, la ville ou le numéro de la commande.`
            : "Les commandes apparaissent ici dès qu’elles sont prises."}
        </EmptyState>
      ) : null}
      {first ? null : (
        <>
          <GroupTitle
            title={searching ? `Résultats pour « ${data.term} »` : "Les plus récentes d’abord"}
            hint={`${data.items.length} commande${data.items.length > 1 ? "s" : ""} affichée${data.items.length > 1 ? "s" : ""}`}
          />
          {data.items.map((item) => (
            <OrderCard key={item.task.orderId} item={item} />
          ))}
          {data.nextCursor === null ? (
            <s-text color="subdued">Seules les commandes des 60 derniers jours sont affichées ici.</s-text>
          ) : (
            <s-grid gridTemplateColumns="minmax(0, 1fr)">
              <s-button {...FILL} icon="arrow-down" href={ordersHref(data.tab, data.term, data.nextCursor)}>
                Voir les commandes plus anciennes
              </s-button>
            </s-grid>
          )}
        </>
      )}
    </s-page>
  );
}
