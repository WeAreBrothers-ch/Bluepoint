import { FactureError } from "./erreurs";

/** Adresse structurée (type S), obligatoire dans la QR-facture depuis novembre 2025. */
export interface RueEtNumero {
  street: string;
  buildingNumber: string;
}

/**
 * Numéro de bâtiment suisse : « 44 », « 3b », « 3 bis », « 12-14 », « 12/14 », « 7A-7C ».
 * Au plus 16 caractères (limite de la QR-facture).
 */
const NUMERO = String.raw`\d{1,5}(?:\s?[a-zA-Z]{1,3})?(?:\s?[-–/]\s?\d{1,5}(?:\s?[a-zA-Z]{1,3})?)?`;

/** Numéro placé en tête : sans espace avant la lettre, sinon « 44 rue » serait lu « 44 r… ». */
const NUMERO_COMPACT = String.raw`\d{1,5}[a-zA-Z]?(?:[-–/]\d{1,5}[a-zA-Z]?)?`;

/** Usage suisse : rue puis numéro, ex. « Rue du Châtelard 44 ». */
const NUMERO_APRES = new RegExp(String.raw`^(.*\p{L}.*?)[\s,]+(${NUMERO})$`, "u");
/** Usage français, parfois saisi en ligne : numéro puis rue, ex. « 44 rue du Châtelard » ou « 44, rue… ». */
const NUMERO_AVANT = new RegExp(String.raw`^(${NUMERO_COMPACT})[\s,]+(\p{L}.*)$`, "u");
const NUMERO_SEUL = new RegExp(String.raw`^${NUMERO}$`, "u");

function nettoyer(texte: string): string {
  return texte.replace(/\s+/g, " ").replace(/^[\s,]+|[\s,.]+$/g, "");
}

function normaliserNumero(numero: string): string {
  return numero.replace(/\s?([-–/])\s?/g, "$1").replace("–", "-");
}

/** Sépare la rue et le numéro d'une ligne d'adresse ; null si aucun numéro n'est reconnu. */
export function separerRueEtNumero(ligne: string): RueEtNumero | null {
  const adresse = nettoyer(ligne);
  const apres = NUMERO_APRES.exec(adresse);
  if (apres?.[1] !== undefined && apres[2] !== undefined) {
    return { street: nettoyer(apres[1]), buildingNumber: normaliserNumero(apres[2]) };
  }
  const avant = NUMERO_AVANT.exec(adresse);
  if (avant?.[1] !== undefined && avant[2] !== undefined) {
    return { street: nettoyer(avant[2]), buildingNumber: normaliserNumero(avant[1]) };
  }
  return null;
}

/**
 * Lit l'adresse saisie dans Shopify (« Adresse » + « Complément d'adresse »).
 * Le numéro est cherché dans la ligne 1, ou dans la ligne 2 si le client l'y a mis seul.
 * Sans numéro reconnu, on s'arrête avec une explication : la QR-facture exige une adresse structurée.
 */
export function lireRueShopify(address1: string, address2?: string | null): RueEtNumero {
  const trouve = separerRueEtNumero(address1);
  if (trouve !== null) return trouve;
  const complement = nettoyer(address2 ?? "");
  if (NUMERO_SEUL.test(complement)) {
    return { street: nettoyer(address1), buildingNumber: normaliserNumero(complement) };
  }
  throw new FactureError(
    `Adresse de facturation sans numéro de rue : « ${nettoyer(address1)} ». ` +
      "La QR-facture exige la rue et le numéro séparés. " +
      "Corriger l'adresse de la commande dans Shopify (ex. « Rue du Châtelard 44 »), puis régénérer la facture.",
  );
}
