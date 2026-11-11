import { baroloPassioneDiRe } from "./bouteilles/barolo-passione-di-re";
import { brunelloSalvioni } from "./bouteilles/brunello-salvioni";
import { colDelFornoProsecco } from "./bouteilles/col-del-forno-prosecco";
import { deuxFreresDryGin } from "./bouteilles/deux-freres-dry-gin";
import { dezaleyTourMarsens } from "./bouteilles/dezaley-tour-marsens";
import type { Bottle } from "./types";

/**
 * Catalogue. Noms, producteurs et prix : repris du site actuel
 * (bluepointdistribution.com, 25/09/2026). Textes de dégustation et accords :
 * provisoires (voir `provisional` dans chaque fichier), à faire valider par Paolo.
 */
export const bottles: ReadonlyArray<Bottle> = [
  baroloPassioneDiRe,
  dezaleyTourMarsens,
  brunelloSalvioni,
  colDelFornoProsecco,
  deuxFreresDryGin,
];
