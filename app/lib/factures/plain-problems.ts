/**
 * Traduit les problèmes techniques du moteur de facture (« vatLines : … », « buyer.postalCode : … »,
 * messages de la QR-facture) en phrases simples qui disent quoi faire.
 * Les messages sont dédoublonnés : plusieurs champs d'adresse manquants donnent une seule phrase.
 */

const VAT =
  "La TVA n’a pas été calculée sur cette commande. Activez la TVA suisse dans Shopify " +
  "(Paramètres › Taxes et droits de douane)\u202F: les commandes suivantes l’auront.";
const BUYER_ADDRESS =
  "L’adresse du client est incomplète (nom, rue et numéro, NPA, localité). " +
  "Corrigez-la dans la commande Shopify (lien « Tous les détails »), puis touchez « Faire la facture ».";
const SELLER = "Vos coordonnées sont incomplètes ou incorrectes\u202F: vérifiez-les dans les Réglages.";
const QR = "Le QR code de paiement n’a pas pu être créé\u202F: vérifiez votre numéro de compte (IBAN) dans les Réglages.";
const AMOUNTS = "Les montants de la commande ne concordent pas\u202F: cette facture doit être faite à la main.";
const CURRENCY = "La commande n’est pas en francs suisses\u202F: la facture ne peut pas être faite automatiquement.";
const OTHER = "Un détail de la commande empêche de faire la facture.";

function translate(problem: string): string {
  const text = problem.trim();
  if (text.startsWith("vatLines") || text.includes("Ligne de TVA")) return VAT;
  if (text.startsWith("buyer") || text.includes("Adresse de facturation") || text.includes("nom du client")) {
    return BUYER_ADDRESS;
  }
  if (text.startsWith("seller") || text.startsWith("iban") || text.startsWith("qrIban")) return SELLER;
  if (text.startsWith("QR-facture") || text.includes("référence QR") || text.includes("référence RF")) return QR;
  if (text.includes("devise")) return CURRENCY;
  if (text.startsWith("totalCents") || text.startsWith("lines") || text.includes("montant")) return AMOUNTS;
  return OTHER;
}

export function plainInvoiceProblems(problems: readonly string[]): string[] {
  return [...new Set(problems.map(translate))];
}
