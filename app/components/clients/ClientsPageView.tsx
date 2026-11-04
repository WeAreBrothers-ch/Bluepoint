import { useCallback, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { phoneDisplay, phoneHref } from "../../lib/agenda/contact";
import { CLIENTS_TABS, clientsHref, type ClientListItem } from "../../lib/clients/list";
import type { ClientsPageData } from "../../lib/clients/list.server";
import { EMPTY_NEW_CUSTOMER } from "../../lib/commande/new-customer";
import type { CustomerOption } from "../../lib/commande/types";
import { formatChf } from "../../lib/format/money";
import { gidToNumericId } from "../../lib/shopify";
import { ClientCard } from "../ClientCard";
import { NewCustomerForm } from "../commande/NewCustomerForm";
import { EmptyState } from "../EmptyState";
import { FILL } from "../fill";
import { GroupTitle } from "../GroupTitle";

/** Page « Clients » : retrouver un client, ouvrir sa fiche, en créer un, sans passer par les menus de Shopify. */

function clientHref(customer: CustomerOption): string {
  return `/app/clients/${gidToNumericId(customer.id)}`;
}

/** « 12 commandes · CHF 3'450.00 », ou « Aucune commande pour l'instant ». */
export function clientStats(item: Pick<ClientListItem, "ordersCount" | "spentCents">): string {
  if (item.ordersCount === 0) return "Aucune commande pour l’instant";
  const orders = `${item.ordersCount} commande${item.ordersCount > 1 ? "s" : ""}`;
  return item.spentCents === null ? orders : `${orders} · ${formatChf(item.spentCents)}`;
}

function ClientRow({ item }: { readonly item: ClientListItem }) {
  const { customer, company } = item;
  const call = phoneHref(customer.phone);
  // La rue et la localité : le nom de l'entreprise est déjà dans le bandeau.
  const place = customer.addressLines.filter((line) => line !== company).join(", ") || null;
  return (
    <ClientCard
      header={
        <>
          <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-heading>{company ?? customer.displayName}</s-heading>
            {customer.isPro ? <s-badge tone="info">Client pro</s-badge> : null}
          </s-stack>
          {company === null ? null : <s-text color="subdued">{customer.displayName}</s-text>}
        </>
      }
    >
      <s-stack direction="block" gap="small-200">
        {place === null ? <s-text color="subdued">Pas d’adresse enregistrée</s-text> : <s-text>{place}</s-text>}
        <s-text color="subdued">{[customer.phone === null ? null : phoneDisplay(customer.phone), customer.email].filter((part) => part !== null).join(" · ") || "Ni téléphone ni e-mail"}</s-text>
        <s-text type="strong">{clientStats(item)}</s-text>
      </s-stack>
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr)">
          <s-button {...FILL} variant="primary" icon="person" href={clientHref(customer)}>
            Voir la fiche
          </s-button>
        </s-grid>
        <s-stack direction="inline" gap="small-100 base" alignItems="center">
          <s-button variant="tertiary" icon="order" href={`/app/commande?client=${gidToNumericId(customer.id)}`}>
            Prendre une commande
          </s-button>
          {call === null ? null : (
            <s-button variant="tertiary" icon="phone" href={call} target="_blank">
              Appeler
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </ClientCard>
  );
}

export function ClientsPageView({ data }: { readonly data: ClientsPageData }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState(data.term);
  const [creating, setCreating] = useState(false);
  const search = (event: FormEvent) => {
    event.preventDefault();
    void navigate(clientsHref(data.tab, term));
  };
  const created = useCallback((customer: CustomerOption) => void navigate(clientHref(customer)), [navigate]);
  const searching = data.term !== "";
  const none = data.items.length === 0;

  return (
    <s-page heading="Mes clients" inlineSize="base">
      {creating ? null : (
        <s-button slot="primary-action" variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Nouveau client
        </s-button>
      )}
      <s-button slot="secondary-actions" href="/app/pros">
        Comptes pro
      </s-button>
      {data.pendingProRequests === 0 ? null : (
        <s-banner tone="info" heading={`${data.pendingProRequests} demande${data.pendingProRequests > 1 ? "s" : ""} de compte pro à valider`}>
          <s-button href="/app/pros">Voir les demandes</s-button>
        </s-banner>
      )}
      {creating ? <NewCustomerForm initial={EMPTY_NEW_CUSTOMER} onCreated={created} onCancel={() => setCreating(false)} /> : null}
      <s-section>
        <s-stack direction="block" gap="base">
          <form onSubmit={search}>
            <s-stack direction="block" gap="small-200">
              <s-search-field
                label="Chercher un client"
                placeholder="Nom, entreprise, ville, téléphone ou e-mail"
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
          <s-grid gridTemplateColumns={`repeat(${CLIENTS_TABS.length}, minmax(0, 1fr))`} gap="small-200">
            {CLIENTS_TABS.map((tab) => (
              <s-button key={tab.id} {...FILL} href={clientsHref(tab.id, data.term)} variant={tab.id === data.tab ? "primary" : "secondary"}>
                {tab.label}
              </s-button>
            ))}
          </s-grid>
        </s-stack>
      </s-section>
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.loadError === null && none ? (
        <EmptyState
          heading={searching ? "Aucun client trouvé" : "Aucun client ici"}
          action={
            searching ? (
              <s-button href={clientsHref(data.tab, "")}>Effacer la recherche</s-button>
            ) : (
              <s-button variant="primary" onClick={() => setCreating(true)}>
                Nouveau client
              </s-button>
            )
          }
        >
          {searching
            ? `Rien ne correspond à « ${data.term} ». Essayez le nom de l’entreprise, la ville ou le numéro de téléphone.`
            : "Les clients apparaissent ici dès qu’ils sont créés."}
        </EmptyState>
      ) : null}
      {none ? null : (
        <>
          <GroupTitle
            title={searching ? `Résultats pour « ${data.term} »` : "Par ordre alphabétique"}
            hint={`${data.items.length} client${data.items.length > 1 ? "s" : ""} affiché${data.items.length > 1 ? "s" : ""}`}
          />
          {data.items.map((item) => (
            <ClientRow key={item.customer.id} item={item} />
          ))}
          {data.nextCursor === null ? null : (
            <s-grid gridTemplateColumns="minmax(0, 1fr)">
              <s-button {...FILL} icon="arrow-down" href={clientsHref(data.tab, data.term, data.nextCursor)}>
                Voir les clients suivants
              </s-button>
            </s-grid>
          )}
        </>
      )}
    </s-page>
  );
}
