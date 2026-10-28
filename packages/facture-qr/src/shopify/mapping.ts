import { ajouterJours, dateLocaleSuisse } from "../dates";
import { sommeCentimes } from "../montants";
import type { InvoiceInput, InvoiceInputRaw, InvoiceSellerRaw } from "../schema";
import { validateInvoiceInput } from "../validation";
import { centimesShopify, lireAcheteur, lireTva } from "./lecture";
import type { ShopifyLineItem, ShopifyOrderForInvoice } from "./types";

/** Ce que Shopify ne connaît pas : numéro (tenu par la base de l'app), dates et conditions de paiement. */
export interface InvoiceMeta {
  invoiceNumber: string;
  /** AAAA-MM-JJ. */
  issueDate: string;
  /** AAAA-MM-JJ : date de livraison des marchandises (mention obligatoire, art. 26 LTVA). */
  deliveryDate: string;
  /** Délai de paiement en jours, 30 par défaut. */
  paymentTermDays?: number;
  /** Texte des conditions, par défaut « Payable à 30 jours ». */
  paymentTerms?: string;
  /** Échéance imposée (AAAA-MM-JJ) ; sinon date de facture + délai. */
  dueDate?: string;
  /** Date de paiement (AAAA-MM-JJ) : produit une facture acquittée, échue le jour même. */
  paidOn?: string;
}

const DELAI_PAR_DEFAUT = 30;
/** Shopify nomme ainsi la variante unique d'un produit : ce n'est pas un contenant. */
const VARIANTE_PAR_DEFAUT = "Default Title";

function ligneFacture(article: ShopifyLineItem, index: number): InvoiceInputRaw["lines"][number] {
  const champ = `Article ${index + 1} (${article.title})`;
  const volume = article.variantTitle?.trim();
  const producteur = article.vendor?.trim();
  return {
    description: article.title.trim(),
    ...(producteur ? { producer: producteur } : {}),
    ...(volume && volume !== VARIANTE_PAR_DEFAUT ? { volumeLabel: volume } : {}),
    quantity: article.quantity,
    unitPriceCents: centimesShopify(article.originalUnitPriceSet, champ),
    totalCents: centimesShopify(article.discountedTotalSet, champ),
  };
}

/** Rabais sur la commande = articles (après rabais de ligne) − sous-total Shopify (après tous les rabais). */
function rabaisCommande(commande: ShopifyOrderForInvoice, lignes: InvoiceInputRaw["lines"]): InvoiceInputRaw["discounts"] {
  const articles = sommeCentimes(lignes.map((l) => l.totalCents));
  const sousTotal = centimesShopify(commande.subtotalPriceSet, "Sous-total");
  const rabais = articles - sousTotal;
  if (rabais <= 0) return [];
  const titres = (commande.discountApplications?.nodes ?? []).flatMap((remise) => (remise.title?.trim() ? [remise.title.trim()] : []));
  const noms = [...titres, ...(commande.discountCodes ?? [])];
  return [{ label: noms.length === 0 ? "Rabais" : `Rabais (${noms.join(", ")})`, amountCents: rabais }];
}

function livraison(commande: ShopifyOrderForInvoice): Pick<InvoiceInputRaw, "shipping"> {
  const ligne = commande.shippingLine;
  if (!ligne) return {};
  return { shipping: { label: ligne.title.trim() || "Livraison", amountCents: centimesShopify(ligne.discountedPriceSet, "Livraison") } };
}

/**
 * Transforme une commande Shopify en facture validée.
 * Lève une `FactureError` claire si une donnée manque (ex. numéro de rue) ou si les totaux ne concordent pas.
 */
export function mapShopifyOrderToInvoiceInput(
  order: ShopifyOrderForInvoice,
  seller: InvoiceSellerRaw,
  meta: InvoiceMeta,
): InvoiceInput {
  const delai = meta.paymentTermDays ?? DELAI_PAR_DEFAUT;
  const lines = order.lineItems.nodes.map(ligneFacture);
  const poNumber = order.poNumber?.trim();
  const brut: InvoiceInputRaw = {
    invoiceNumber: meta.invoiceNumber,
    issueDate: meta.issueDate,
    deliveryDate: meta.deliveryDate,
    dueDate: meta.paidOn === undefined ? (meta.dueDate ?? ajouterJours(meta.issueDate, delai)) : meta.issueDate,
    orderDate: dateLocaleSuisse(order.createdAt),
    seller,
    buyer: lireAcheteur(order),
    lines,
    ...livraison(order),
    discounts: rabaisCommande(order, lines),
    taxesIncluded: order.taxesIncluded,
    vatLines: lireTva(order),
    currency: "CHF",
    totalCents: centimesShopify(order.totalPriceSet, "Total"),
    paymentTerms: meta.paymentTerms ?? (meta.paidOn === undefined ? `Payable à ${delai} jours` : "Payée en ligne"),
    orderReference: order.name,
    ...(poNumber ? { poNumber } : {}),
    ...(meta.paidOn === undefined ? {} : { paidOn: meta.paidOn }),
  };
  return validateInvoiceInput(brut);
}
