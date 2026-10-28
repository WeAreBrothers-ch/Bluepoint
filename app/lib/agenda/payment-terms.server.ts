import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { PaymentTermsInfo } from "./types";

/**
 * Conditions de paiement des commandes pas encore payées (Admin API 2026-10, `read_payment_terms`).
 * Requête à part : si Shopify la refuse, l'agenda s'affiche quand même, sans ce détail.
 */

const BATCH = 100;

const PAYMENT_TERMS_QUERY = `#graphql
query ConditionsPaiement($ids: [ID!]!) {
  nodes(ids: $ids) { ... on Order { id paymentTerms { paymentTermsType dueInDays } } }
}`;

interface PaymentTermsData {
  readonly nodes: readonly ({
    readonly id?: string;
    readonly paymentTerms?: { readonly paymentTermsType: string; readonly dueInDays: number | null } | null;
  } | null)[];
}

export async function loadPaymentTerms(admin: AdminApiContext, orderIds: readonly string[]): Promise<Map<string, PaymentTermsInfo>> {
  const terms = new Map<string, PaymentTermsInfo>();
  for (let start = 0; start < orderIds.length; start += BATCH) {
    const result = await runAdminGraphql<PaymentTermsData>(admin, PAYMENT_TERMS_QUERY, { ids: orderIds.slice(start, start + BATCH) });
    if (!result.ok) {
      logError("Conditions de paiement illisibles : badges simples dans l'agenda", result.error);
      return terms;
    }
    for (const node of result.value.nodes) {
      if (node?.id !== undefined && node.paymentTerms) {
        terms.set(node.id, { type: node.paymentTerms.paymentTermsType, dueInDays: node.paymentTerms.dueInDays });
      }
    }
  }
  return terms;
}
