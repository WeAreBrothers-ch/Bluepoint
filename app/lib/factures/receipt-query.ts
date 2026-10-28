import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { OrderGid } from "../shopify/ids";
import { InvoiceError } from "./errors";
import { toReceiptFacts, type ReceiptFacts, type ReceiptOrderData } from "./pro-order";

/** Lecture de ce qu'il faut pour décider d'un reçu pro : client, entreprise, paiement, livraison prévue. */
const RECEIPT_QUERY = `#graphql
query RecuPro($id: ID!) {
  order(id: $id) {
    displayFinancialStatus
    customer { tags }
    purchasingEntity { __typename }
    dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
  }
}`;

interface ReceiptData {
  readonly order: ReceiptOrderData | null;
}

export async function fetchReceiptFacts(admin: AdminApiContext, orderId: OrderGid): Promise<Result<ReceiptFacts, InvoiceError>> {
  const result = await runAdminGraphql<ReceiptData>(admin, RECEIPT_QUERY, { id: orderId });
  if (!result.ok) return failure(new InvoiceError("shopify_indisponible"));
  if (result.value.order === null) return failure(new InvoiceError("commande_introuvable"));
  return success(toReceiptFacts(result.value.order));
}
