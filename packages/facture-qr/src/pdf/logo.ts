import { CADRAGES_LOGO, DECALAGE_ROTATION, LOGO_HAUTEUR, LOGO_LARGEUR, TRACES_LOGO } from "./logo-traces";
import { COULEURS } from "./styles";

/** Largeur du logo dessiné à une hauteur donnée (proportions du SVG d'origine). */
export function largeurLogo(hauteur: number): number {
  return (hauteur * LOGO_LARGEUR) / LOGO_HAUTEUR;
}

/**
 * Dessine le logo vectoriel en bleu BluePoint, en reproduisant les transformations du SVG :
 * chaque recadrage est mis à l'échelle, découpé à sa viewBox, puis les tracés sont tournés de 90°.
 */
export function dessinerLogo(doc: PDFKit.PDFDocument, x: number, y: number, hauteur: number): void {
  doc.save().translate(x, y).scale(hauteur / LOGO_HAUTEUR);
  for (const cadrage of CADRAGES_LOGO) {
    const echelle = Math.min(cadrage.largeur / cadrage.vbLargeur, cadrage.hauteur / cadrage.vbHauteur);
    const centrage = (cadrage.largeur - cadrage.vbLargeur * echelle) / 2;
    doc.save().translate(cadrage.x + centrage, 0).scale(echelle);
    doc.rect(0, 0, cadrage.vbLargeur, cadrage.vbHauteur).clip();
    doc.translate(-cadrage.vbX, -cadrage.vbY).translate(DECALAGE_ROTATION, 0).rotate(90);
    for (const trace of TRACES_LOGO) doc.path(trace);
    doc.fill(COULEURS.bleu);
    doc.restore();
  }
  doc.restore();
}
