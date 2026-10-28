/**
 * Factures BluePoint Distribution avec QR-facture suisse.
 * Fonctions pures : aucune écriture de fichier, aucun accès réseau.
 */
export { renderInvoicePdf } from "./pdf/document";
export { validateInvoiceInput } from "./validation";
export { mapShopifyOrderToInvoiceInput, type InvoiceMeta } from "./shopify/mapping";
export { SHOPIFY_ORDER_INVOICE_QUERY } from "./shopify/requete";
export { FactureError } from "./erreurs";
export { separerRueEtNumero } from "./adresse";
export { referenceQrr, referenceScor } from "./reference";
export { formaterCHF } from "./montants";
export type {
  InvoiceBuyer,
  InvoiceInput,
  InvoiceInputRaw,
  InvoiceLine,
  InvoiceSeller,
  InvoiceSellerRaw,
  InvoiceVatLine,
} from "./schema";
export type {
  ShopifyCustomer,
  ShopifyLineItem,
  ShopifyMailingAddress,
  ShopifyMoney,
  ShopifyMoneyBag,
  ShopifyOrderForInvoice,
  ShopifyShippingLine,
  ShopifyTaxLine,
} from "./shopify/types";
