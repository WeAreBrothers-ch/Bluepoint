/** Numéros de facture BluePoint : BP-AAAA-NNNN (séquence remise à 1 chaque année). */

export const INVOICE_PREFIX = "BP";

export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError(`Année invalide : ${year}`);
  if (!Number.isInteger(sequence) || sequence < 1) throw new RangeError(`Séquence invalide : ${sequence}`);
  return `${INVOICE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Année d'une date AAAA-MM-JJ. */
export function yearOfIsoDate(date: string): number {
  const year = Number.parseInt(date.slice(0, 4), 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(year)) throw new RangeError(`Date invalide : ${date}`);
  return year;
}
