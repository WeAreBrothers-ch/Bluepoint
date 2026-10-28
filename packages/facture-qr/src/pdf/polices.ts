import { FactureError } from "../erreurs";
import { POLICES_INTEGREES } from "./polices-integrees";
import { POLICES, type NomPolice } from "./styles";

/**
 * Geist Mono (licence SIL OFL 1.1, voir assets/fonts/OFL.txt), intégrée au code du paquet
 * (polices-integrees.ts, généré par npm run polices) : aucune police système, aucune lecture de fichier.
 */
const FICHIERS: Record<NomPolice, string> = {
  [POLICES.normale]: "GeistMono-Regular.ttf",
  [POLICES.moyenne]: "GeistMono-Medium.ttf",
  [POLICES.grasse]: "GeistMono-SemiBold.ttf",
};

let cache: ReadonlyMap<NomPolice, Buffer> | null = null;

function chargerPolices(): ReadonlyMap<NomPolice, Buffer> {
  if (cache !== null) return cache;
  const polices = new Map<NomPolice, Buffer>();
  for (const [nom, fichier] of Object.entries(FICHIERS) as [NomPolice, string][]) {
    const contenu = POLICES_INTEGREES[fichier];
    if (contenu === undefined) {
      throw new FactureError(`Police absente du paquet : ${fichier}. Relancer npm run polices.`);
    }
    polices.set(nom, Buffer.from(contenu, "base64"));
  }
  cache = polices;
  return polices;
}

export function enregistrerPolices(doc: PDFKit.PDFDocument): void {
  for (const [nom, contenu] of chargerPolices()) doc.registerFont(nom, contenu);
}

/**
 * Geist Mono n'a pas de glyphe pour l'espace fine insécable (U+202F) : on la remplace par
 * l'espace insécable (U+00A0), qui garde le signe collé au mot. En chasse fixe, les deux auraient
 * de toute façon la même largeur que les autres caractères.
 */
export function adapterAuxGlyphes(texte: string): string {
  return texte.replace(/ /g, " ");
}
