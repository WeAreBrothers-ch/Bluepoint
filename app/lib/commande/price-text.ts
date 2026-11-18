import { formatChf } from "../format/money";
import { proCentsFromPublic } from "../prix/pro";
import { NNBSP } from "../format/typography";
import { CARTON_SIZE } from "./types";

/** Pour qui sont les prix affichés dans la liste des vins : le client choisi, ou personne encore. */
export type PriceAudience = "pro" | "particulier" | null;

/**
 * Prix d'un vin dans la liste « Vins » : seulement celui qui compte pour le client au téléphone
 * (pro ou particulier), à la bouteille et au carton. Sans client choisi, les deux prix de la bouteille.
 * Shopify garde le prix particulier ; le prix pro est ce prix sans les 15 %.
 */
export function winePriceText(publicCents: number, audience: PriceAudience): string {
  const pro = proCentsFromPublic(publicCents);
  if (audience === null) return `Bouteille${NNBSP}: ${formatChf(pro)} pro, ${formatChf(publicCents)} particulier`;
  const unit = audience === "pro" ? pro : publicCents;
  return `${formatChf(unit)} la bouteille · ${formatChf(unit * CARTON_SIZE)} le carton${audience === "pro" ? " (prix pro)" : ""}`;
}
