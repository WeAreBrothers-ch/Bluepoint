import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { addressText, directionsUrl, phoneDisplay, phoneHref } from "../../lib/agenda/contact";
import { clientStats } from "./ClientsPageView";
import type { ClientPageData } from "../../lib/clients/detail.server";
import type { NewCustomerValues } from "../../lib/commande/new-customer";
import type { ClientEditResult } from "../../routes/app.clients.$id";
import { ClientCard } from "../ClientCard";
import { ClientKindBadge, clientKind } from "../ClientKindBadge";
import { OrderCard } from "../commandes/OrdersPageView";
import { ClientInvoices } from "./ClientInvoices";
import { CustomerFields } from "../commande/CustomerFields";
import { FILL } from "../fill";
import { GroupTitle } from "../GroupTitle";

/** Fiche d'un client : ses coordonnées (qu'on peut modifier), puis ses dernières commandes. */

function editValues(data: ClientPageData): NewCustomerValues {
  const customer = data.client?.customer;
  const address = customer?.address ?? null;
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    company: address?.company ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    street: address?.address1 ?? "",
    postalCode: address?.zip ?? "",
    city: address?.city ?? "",
  };
}

interface EditFormProps {
  readonly data: ClientPageData;
  readonly numericId: string;
  readonly onDone: (message: string) => void;
  readonly onCancel: () => void;
}

function ClientEditForm({ data, numericId, onDone, onCancel }: EditFormProps) {
  const fetcher = useFetcher<ClientEditResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const failed = result !== undefined && !result.ok ? result : undefined;
  const values = failed?.values ?? editValues(data);

  useEffect(() => {
    if (result?.ok) onDone(result.message);
  }, [result, onDone]);

  return (
    <s-section heading="Modifier les coordonnées">
      <fetcher.Form method="post" action={`/app/clients/${numericId}`}>
        <input type="hidden" name="addressId" value={data.addressId ?? ""} />
        <s-stack direction="block" gap="base">
          {/* Remonté à neuf après une erreur pour réafficher ce qui a été tapé. */}
          <s-stack key={failed === undefined ? "vide" : JSON.stringify(values)} direction="block" gap="base">
            <CustomerFields values={values} errors={failed?.errors ?? {}} />
          </s-stack>
          {failed === undefined ? null : <s-banner tone="critical" heading={failed.message} />}
          <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
            <s-button {...FILL} type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
              Enregistrer
            </s-button>
            <s-button {...FILL} onClick={onCancel} {...(busy ? { disabled: true } : {})}>
              Annuler
            </s-button>
          </s-grid>
        </s-stack>
      </fetcher.Form>
    </s-section>
  );
}

export function ClientPageView({ data, numericId }: { readonly data: ClientPageData; readonly numericId: string }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const done = useCallback((message: string) => {
    setEditing(false);
    setSaved(message);
  }, []);
  const client = data.client;

  if (client === null) {
    return (
      <s-page heading="Client" inlineSize="base">
        <s-button slot="secondary-actions" href="/app/clients">
          Retour aux clients
        </s-button>
        <s-banner tone="warning" heading={data.problem ?? "Ce client n’existe pas."}>
          <s-button href="/app/clients">Retour aux clients</s-button>
        </s-banner>
      </s-page>
    );
  }

  const { customer, company } = client;
  const call = phoneHref(customer.phone);
  const place =
    customer.address === null
      ? null
      : { street: customer.address.address1?.trim() || null, zip: customer.address.zip?.trim() || null, city: customer.address.city?.trim() || null };
  const address = place === null ? null : addressText(place);
  const directions = place === null ? null : directionsUrl(place);
  const mail = customer.email === null ? null : `mailto:${customer.email}`;
  // Le nom de l'entreprise est déjà dans le bandeau.
  const addressLines = customer.addressLines.filter((line) => line !== company);

  return (
    <s-page heading={company ?? customer.displayName} inlineSize="base">
      <s-button slot="primary-action" variant="primary" icon="plus" href={`/app/commande?client=${numericId}`}>
        Prendre une commande
      </s-button>
      <s-button slot="secondary-actions" href="/app/clients">
        Retour aux clients
      </s-button>
      {saved === null ? null : <s-banner tone="success" heading={saved} />}
      {editing ? (
        <ClientEditForm data={data} numericId={numericId} onDone={done} onCancel={() => setEditing(false)} />
      ) : (
        <ClientCard
          kind={clientKind(customer.isPro)}
          header={
            <>
              <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                <s-heading>{company ?? customer.displayName}</s-heading>
                <ClientKindBadge isPro={customer.isPro} />
              </s-stack>
              {company === null ? null : <s-text color="subdued">{customer.displayName}</s-text>}
              <s-text type="strong">{clientStats(client)}</s-text>
            </>
          }
        >
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Adresse</s-text>
            {addressLines.length === 0 ? (
              <s-text tone="caution">Pas d’adresse enregistrée. Ajoutez-la avec « Modifier les coordonnées ».</s-text>
            ) : (
              addressLines.map((line) => <s-text key={line}>{line}</s-text>)
            )}
            {directions === null || address === null ? null : (
              <s-stack direction="inline">
                <s-button icon="location" href={directions} target="_blank">
                  Itinéraire
                </s-button>
              </s-stack>
            )}
          </s-stack>
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Téléphone</s-text>
            {call === null || customer.phone === null ? (
              <s-text color="subdued">Pas de téléphone enregistré</s-text>
            ) : (
              <>
                <s-text>{phoneDisplay(customer.phone)}</s-text>
                <s-stack direction="inline">
                  <s-button icon="phone" href={call} target="_blank">
                    Appeler
                  </s-button>
                </s-stack>
              </>
            )}
          </s-stack>
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">E-mail</s-text>
            {mail === null || customer.email === null ? (
              <s-text color="subdued">Pas d’e-mail enregistré</s-text>
            ) : (
              <>
                <s-text>{customer.email}</s-text>
                <s-stack direction="inline">
                  <s-button icon="email" href={mail} target="_blank">
                    Écrire
                  </s-button>
                </s-stack>
              </>
            )}
          </s-stack>
          <s-grid gridTemplateColumns="minmax(0, 1fr)">
            <s-button {...FILL} icon="edit" onClick={() => setEditing(true)}>
              Modifier les coordonnées
            </s-button>
          </s-grid>
        </ClientCard>
      )}
      <ClientInvoices invoices={data.invoices} />
      <GroupTitle
        title={data.orders.length === 0 ? "Aucune commande pour l’instant" : "Ses dernières commandes"}
        {...(data.orders.length === 0 ? {} : { hint: `${data.orders.length} affichée${data.orders.length > 1 ? "s" : ""} sur ${client.ordersCount}` })}
      />
      {data.orders.map((item) => (
        <OrderCard key={item.task.orderId} item={item} clientId={numericId} />
      ))}
      {client.ordersCount <= data.orders.length ? null : (
        <s-grid gridTemplateColumns="minmax(0, 1fr)">
          <s-button {...FILL} icon="search" href={`/app/commandes?q=${encodeURIComponent(customer.displayName)}`}>
            Voir toutes ses commandes
          </s-button>
        </s-grid>
      )}
    </s-page>
  );
}

