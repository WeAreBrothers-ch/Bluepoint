import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FactureError, mapShopifyOrderToInvoiceInput, renderInvoicePdf } from "../src/index";
import { COMMANDE_SHOPIFY, META_EXEMPLE } from "../src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../src/fixtures/vendeur";

/** Génère une facture d'exemple depuis la commande fictive #1042 et l'écrit dans le dossier temporaire. */
async function executer(): Promise<void> {
  const facture = mapShopifyOrderToInvoiceInput(COMMANDE_SHOPIFY, VENDEUR_EXEMPLE, META_EXEMPLE);
  const pdf = await renderInvoicePdf(facture);
  const chemin = join(tmpdir(), "exemple.pdf");
  await writeFile(chemin, pdf);
  process.stdout.write(`${chemin}\n`);
}

executer().catch((erreur: unknown) => {
  const message = erreur instanceof FactureError || erreur instanceof Error ? erreur.message : "Erreur inattendue.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
