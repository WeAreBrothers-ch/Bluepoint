import type { z } from "zod";
import { FactureError } from "./erreurs";
import { formaterCHF } from "./montants";
import { referencePaiement } from "./reference";
import { calculerTotaux, type DonneesTotaux } from "./totaux";

/** Écart toléré entre le total annoncé et le total recalculé (arrondis Shopify). */
export const TOLERANCE_CENTIMES = 1;

interface DonneesCoherence extends DonneesTotaux {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  seller: { qrIban?: string | undefined };
}

function verifierTotal(f: DonneesCoherence, ctx: z.RefinementCtx): void {
  const totaux = calculerTotaux(f);
  const ecart = Math.abs(totaux.totalCalculeCents - f.totalCents);
  if (ecart > TOLERANCE_CENTIMES) {
    const formule = f.taxesIncluded ? "articles − rabais + livraison" : "articles − rabais + livraison + TVA";
    ctx.addIssue({
      code: "custom",
      path: ["totalCents"],
      message: `Total incohérent : ${formule} = ${formaterCHF(totaux.totalCalculeCents)}, mais le total indiqué est ${formaterCHF(f.totalCents)}.`,
    });
  }
  if (totaux.rabaisCents > totaux.articlesCents) {
    ctx.addIssue({ code: "custom", path: ["discounts"], message: "Les rabais dépassent le montant des articles." });
  }
  if (totaux.tvaCents > f.totalCents) {
    ctx.addIssue({ code: "custom", path: ["vatLines"], message: "La TVA dépasse le total de la facture." });
  }
}

function verifierReference(f: DonneesCoherence, ctx: z.RefinementCtx): void {
  try {
    referencePaiement(f.invoiceNumber, f.seller.qrIban !== undefined);
  } catch (erreur) {
    if (!(erreur instanceof FactureError)) throw erreur;
    ctx.addIssue({ code: "custom", path: ["invoiceNumber"], message: erreur.message });
  }
}

/** Contrôles qui portent sur plusieurs champs à la fois. */
export function verifierCoherence(f: DonneesCoherence, ctx: z.RefinementCtx): void {
  if (f.dueDate < f.issueDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "L'échéance est antérieure à la date de facture." });
  }
  verifierTotal(f, ctx);
  verifierReference(f, ctx);
}
