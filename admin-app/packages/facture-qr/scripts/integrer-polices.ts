/**
 * Génère src/pdf/polices-integrees.ts à partir de assets/fonts/*.ttf.
 * Les polices voyagent ainsi dans le code : aucune lecture de fichier au moment de créer
 * le PDF, donc aucun chemin cassé une fois le paquet intégré au build d'une app (Vercel…).
 * À relancer (npm run polices) après tout changement dans assets/fonts.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DOSSIER = new URL("../assets/fonts/", import.meta.url);
const CIBLE = new URL("../src/pdf/polices-integrees.ts", import.meta.url);

const fichiers = readdirSync(DOSSIER)
  .filter((fichier) => fichier.endsWith(".ttf"))
  .sort();

const lignes = fichiers.map(
  (fichier) => `  ${JSON.stringify(fichier)}: ${JSON.stringify(readFileSync(new URL(fichier, DOSSIER)).toString("base64"))},`,
);

writeFileSync(
  CIBLE,
  [
    "/* Fichier généré par scripts/integrer-polices.ts : ne pas modifier à la main. */",
    "/* Geist Mono, licence SIL OFL 1.1 (voir assets/fonts/OFL.txt), encodée en base64. */",
    "export const POLICES_INTEGREES: Readonly<Record<string, string>> = {",
    ...lignes,
    "};",
    "",
  ].join("\n"),
);
