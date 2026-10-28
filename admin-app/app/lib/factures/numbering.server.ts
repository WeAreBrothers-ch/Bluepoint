import type { Prisma } from "@prisma/client";

/**
 * Réserve le prochain numéro de la séquence (boutique, année), de façon atomique :
 * INSERT … ON CONFLICT DO UPDATE verrouille la ligne jusqu'à la fin de la transaction.
 * Si la transaction échoue (facture invalide, doublon), le compteur revient en arrière :
 * aucun numéro n'est perdu ni attribué deux fois.
 */
export async function nextInvoiceSequence(tx: Prisma.TransactionClient, shop: string, year: number): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("shop", "year", "value") VALUES (${shop}, ${year}, 1)
    ON CONFLICT ("shop", "year") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  const value = rows[0]?.value;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Compteur de factures illisible");
  }
  return value;
}
