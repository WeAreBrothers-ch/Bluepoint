import { TOLERANCE_CENTIMES } from "../coherence";
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

/**
 * Total des bouteilles encore sur la commande. Shopify garde dans `discountedTotalSet` les bouteilles retirées
 * par « Modifier les vins » : on n'en facture que la part des bouteilles restantes.
 */
function totalActuel(article: ShopifyLineItem, champ: string): number {
  const total = centimesShopify(article.discountedTotalSet, champ);
  if (article.currentQuantity === article.quantity) return total;
  return Math.round((total * article.currentQuantity) / article.quantity);
}

function ligneFacture(article: ShopifyLineItem, index: number): InvoiceInputRaw["lines"][number] {
  const champ = `Article ${index + 1} (${article.title})`;
  const volume = article.variantTitle?.trim();
  const producteur = article.vendor?.trim();
  return {
    description: article.title.trim(),
    ...(producteur ? { producer: producteur } : {}),
    ...(volume && volume !== VARIANTE_PAR_DEFAUT ? { volumeLabel: volume } : {}),
    quantity: article.currentQuantity,
    unitPriceCents: centimesShopify(article.originalUnitPriceSet, champ),
    totalCents: totalActuel(article, champ),
  };
}

function nomsDesRabais(commande: ShopifyOrderForInvoice): string[] {
  const titres = (commande.discountApplications?.nodes ?? []).flatMap((remise) => (remise.title?.trim() ? [remise.title.trim()] : []));
  return [...titres, ...(commande.discountCodes ?? [])];
}

/**
 * Rabais sur la commande = articles (après rabais de ligne) − sous-total Shopify (après tous les rabais).
 * Un écart d'un centime sans aucun rabais nommé vient de l'arrondi d'une ligne modifiée : ce n'est pas un rabais.
 */
function rabaisCommande(commande: ShopifyOrderForInvoice, lignes: InvoiceInputRaw["lines"]): InvoiceInputRaw["discounts"] {
  const articles = sommeCentimes(lignes.map((l) => l.totalCents));
  const sousTotal = centimesShopify(commande.currentSubtotalPriceSet, "Sous-total");
  const rabais = articles - sousTotal;
  const noms = nomsDesRabais(commande);
  if (rabais <= 0 || (rabais <= TOLERANCE_CENTIMES && noms.length === 0)) return [];
  return [{ label: noms.length === 0 ? "Rabais" : `Rabais (${noms.join(", ")})`, amountCents: rabais }];
}

function livraison(commande: ShopifyOrderForInvoice): Pick<InvoiceInputRaw, "shipping"> {
  const ligne = commande.shippingLine;
  if (!ligne) return {};
  return { shipping: { label: ligne.title.trim() || "Livraison", amountCents: centimesShopify(commande.currentShippingPriceSet, "Livraison") } };
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
  const lines = order.lineItems.nodes.filter((article) => article.currentQuantity > 0).map(ligneFacture);
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
    totalCents: centimesShopify(order.currentTotalPriceSet, "Total"),
    paymentTerms: meta.paymentTerms ?? (meta.paidOn === undefined ? `Payable à ${delai} jours` : "Payée en ligne"),
    orderReference: order.name,
    ...(poNumber ? { poNumber } : {}),
    ...(meta.paidOn === undefined ? {} : { paidOn: meta.paidOn }),
  };
  return validateInvoiceInput(brut);
}
