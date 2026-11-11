import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { PAS_ENCORE_ACTIVE } from "../titres";
import { cannotDeleteMessage, companyCleanup, type CompanyProfile, type DeleteClientResult } from "./delete";

/** Supprime un client sans commande, et son entreprise pro si elle ne sert qu'à lui (`write_customers`). */

const CLIENT_QUERY = `#graphql
query ClientASupprimer($id: ID!) {
  customer(id: $id) {
    displayName
    numberOfOrders
    companyContactProfiles { id company { id ordersCount { count } contactsCount { count } } }
  }
}`;

const DELETE_COMPANY = `#graphql
mutation SupprimerEntreprise($id: ID!) { companyDelete(id: $id) { deletedCompanyId userErrors { field message } } }`;

const DELETE_CONTACT = `#graphql
mutation RetirerContact($id: ID!) { companyContactDelete(companyContactId: $id) { deletedCompanyContactId userErrors { field message } } }`;

const DELETE_CUSTOMER = `#graphql
mutation SupprimerClient($id: ID!) { customerDelete(input: { id: $id }) { deletedCustomerId userErrors { field message } } }`;

interface ClientData {
  readonly customer: {
    readonly displayName: string;
    readonly numberOfOrders: string;
    readonly companyContactProfiles: readonly {
      readonly id: string;
      readonly company: { readonly id: string; readonly ordersCount: { readonly count: number } | null; readonly contactsCount: { readonly count: number } | null };
    }[];
  } | null;
}

type Payload = { readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[] };

function refused(error: Error): DeleteClientResult {
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  const denied = /access denied|access scope/i.test(error.message);
  return { ok: false, intent: "supprimer", message: plain ?? (denied ? PAS_ENCORE_ACTIVE : "Le client n’a pas pu être supprimé. Réessayez dans un instant.") };
}

export async function handleDeleteClient(admin: AdminApiContext, numericId: string): Promise<DeleteClientResult> {
  if (!/^\d{1,20}$/.test(numericId)) return { ok: false, intent: "supprimer", message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  const id = `gid://shopify/Customer/${numericId}`;
  // Tout est relu juste avant : une commande arrivée entre-temps empêche la suppression.
  const read = await runAdminGraphql<ClientData>(admin, CLIENT_QUERY, { id });
  if (!read.ok) {
    logError("Client à supprimer illisible", read.error, { numericId });
    return { ok: false, intent: "supprimer", message: "Shopify ne répond pas pour le moment. Réessayez dans un instant : rien n’a été effacé." };
  }
  const customer = read.value.customer;
  if (customer === null) return { ok: false, intent: "supprimer", message: "Ce client n’existe plus." };
  const orders = Number(customer.numberOfOrders) || 0;
  if (orders > 0) return { ok: false, intent: "supprimer", message: cannotDeleteMessage(orders) };

  for (const profile of customer.companyContactProfiles) {
    const info: CompanyProfile = {
      contactId: profile.id,
      companyId: profile.company.id,
      orders: profile.company.ordersCount?.count ?? 0,
      contacts: profile.company.contactsCount?.count ?? 1,
    };
    const step =
      companyCleanup(info) === "entreprise"
        ? await runAdminMutation(admin, DELETE_COMPANY, (data: { companyDelete: Payload | null }) => data.companyDelete, { id: info.companyId })
        : await runAdminMutation(admin, DELETE_CONTACT, (data: { companyContactDelete: Payload | null }) => data.companyContactDelete, { id: info.contactId });
    if (!step.ok) {
      logError("Entreprise du client non supprimée", step.error, { numericId });
      return refused(step.error);
    }
  }

  const deleted = await runAdminMutation(admin, DELETE_CUSTOMER, (data: { customerDelete: Payload | null }) => data.customerDelete, { id });
  if (!deleted.ok) {
    logError("Client non supprimé", deleted.error, { numericId });
    return refused(deleted.error);
  }
  logInfo("Client supprimé", { numericId, companies: customer.companyContactProfiles.length });
  return { ok: true, intent: "supprimer", name: customer.displayName };
}
