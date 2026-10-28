import { lireRueShopify } from "../adresse";
import { FactureError } from "../erreurs";
import { centimesDepuisTexte } from "../montants";
import type { InvoiceInputRaw } from "../schema";
import type { ShopifyMailingAddress, ShopifyMoneyBag, ShopifyOrderForInvoice, ShopifyTaxLine } from "./types";

type AcheteurBrut = InvoiceInputRaw["buyer"];
type TvaBrute = InvoiceInputRaw["vatLines"][number];

/** Montant Shopify en devise de la boutique → centimes. Refuse toute autre devise que CHF. */
export function centimesShopify(montant: ShopifyMoneyBag, champ: string): number {
  const { amount, currencyCode } = montant.shopMoney;
  if (currencyCode !== "CHF") {
    throw new FactureError(`${champ} : devise ${currencyCode} reçue, seule la devise CHF est facturée.`);
  }
  const centimes = centimesDepuisTexte(amount);
  if (centimes === null) throw new FactureError(`${champ} : montant illisible « ${amount} ».`);
  return centimes;
}

function texteOuAbsent(valeur: string | null | undefined): string | undefined {
  const propre = valeur?.trim();
  return propre === undefined || propre === "" ? undefined : propre;
}

function nomAcheteur(adresse: ShopifyMailingAddress, commande: ShopifyOrderForInvoice): string {
  const nomComplet = [adresse.firstName, adresse.lastName].map(texteOuAbsent).filter(Boolean).join(" ");
  const nom = texteOuAbsent(adresse.name) ?? texteOuAbsent(nomComplet) ?? texteOuAbsent(commande.customer?.displayName);
  if (nom === undefined) {
    throw new FactureError(`Commande ${commande.name} : nom du client manquant dans l'adresse de facturation.`);
  }
  return nom;
}

/** Client facturé : adresse de facturation, à défaut adresse de livraison. */
export function lireAcheteur(commande: ShopifyOrderForInvoice): AcheteurBrut {
  const adresse = commande.billingAddress ?? commande.shippingAddress;
  if (!adresse) {
    throw new FactureError(
      `Commande ${commande.name} : aucune adresse de facturation. Le nom et le lieu du client sont obligatoires sur une facture avec TVA.`,
    );
  }
  const ligne1 = texteOuAbsent(adresse.address1);
  const company = texteOuAbsent(adresse.company);
  const postalCode = texteOuAbsent(adresse.zip);
  const country = texteOuAbsent(adresse.countryCodeV2);
  return {
    name: nomAcheteur(adresse, commande),
    city: adresse.city?.trim() ?? "",
    ...(company === undefined ? {} : { company }),
    ...(ligne1 === undefined ? {} : lireRueShopify(ligne1, adresse.address2)),
    ...(postalCode === undefined ? {} : { postalCode }),
    ...(country === undefined ? {} : { country }),
  };
}

function tauxEnPourcent(ligne: ShopifyTaxLine): number {
  const taux = ligne.ratePercentage ?? (ligne.rate === null || ligne.rate === undefined ? null : ligne.rate * 100);
  if (taux === null) throw new FactureError(`Ligne de TVA « ${ligne.title} » sans taux.`);
  return Math.round(taux * 100) / 100;
}

/** Lignes de TVA de Shopify, regroupées par taux (jamais recalculées). */
export function lireTva(commande: ShopifyOrderForInvoice): TvaBrute[] {
  const parTaux = new Map<number, number>();
  for (const ligne of commande.taxLines) {
    const taux = tauxEnPourcent(ligne);
    const montant = centimesShopify(ligne.priceSet, `TVA ${ligne.title}`);
    parTaux.set(taux, (parTaux.get(taux) ?? 0) + montant);
  }
  return [...parTaux].map(([ratePercent, amountCents]) => ({ ratePercent, amountCents }));
}
