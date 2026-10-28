import { z } from "zod";
import { lireDateIsoOuNull } from "./dates";
import { estQrIban, ibanSuisseValide, normaliserIban, normaliserNumeroTva } from "./identifiants";
import { verifierCoherence } from "./coherence";

/** Plafond de la QR-facture : CHF 999’999’999.99. */
const MONTANT_MAX = 99_999_999_999;

const texte = (max: number) => z.string().trim().min(1, "Champ obligatoire.").max(max, `${max} caractères au plus.`);

const centimes = z
  .number()
  .int("Montant attendu en centimes entiers (ex. CHF 24.50 → 2450).")
  .min(0, "Le montant ne peut pas être négatif.")
  .max(MONTANT_MAX, "Montant trop élevé pour une QR-facture.");

const dateIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
  .refine((iso) => lireDateIsoOuNull(iso) !== null, "Date impossible.");

const pays = z.string().trim().toUpperCase().length(2, "Code pays à 2 lettres attendu (ex. CH).").default("CH");

const iban = z
  .string()
  .transform(normaliserIban)
  .refine(ibanSuisseValide, "IBAN suisse (CH) ou liechtensteinois (LI) invalide.");

const sellerSchema = z.object({
  name: texte(70),
  street: texte(70),
  buildingNumber: texte(16),
  postalCode: texte(16),
  city: texte(35),
  country: pays,
  vatNumber: z.string().transform((brut, ctx) => {
    const tva = normaliserNumeroTva(brut);
    if (tva === null) ctx.addIssue({ code: "custom", message: "Numéro TVA invalide (format CHE-123.456.789 TVA, chiffre de contrôle vérifié)." });
    return tva ?? brut;
  }),
  iban: iban.refine((v) => !estQrIban(v), "Cet IBAN est un QR-IBAN : le mettre dans « qrIban »."),
  qrIban: iban.refine(estQrIban, "Ce compte n'est pas un QR-IBAN (identifiant bancaire 30000 à 31999).").optional(),
  email: z.email("Adresse e-mail invalide."),
  phone: texte(30),
});

const buyerSchema = z.object({
  name: texte(70),
  company: texte(70).optional(),
  street: texte(70).optional(),
  buildingNumber: texte(16).optional(),
  postalCode: texte(16).optional(),
  /** Lieu du client : mention obligatoire (art. 26 LTVA). */
  city: texte(35),
  country: pays,
});

const lineSchema = z
  .object({
    description: texte(120),
    producer: texte(70).optional(),
    volumeLabel: texte(20).optional(),
    quantity: z.number().int("Quantité entière attendue.").min(1, "Quantité d'au moins 1.").max(99_999),
    unitPriceCents: centimes,
    totalCents: centimes,
  })
  .refine((l) => l.totalCents <= l.quantity * l.unitPriceCents, {
    message: "Le total de la ligne dépasse quantité × prix unitaire.",
    path: ["totalCents"],
  });

const montantLibelle = z.object({ label: texte(60), amountCents: centimes });

const vatLineSchema = z.object({
  ratePercent: z.number().min(0, "Taux négatif.").max(100, "Taux supérieur à 100 %."),
  amountCents: centimes,
});

export const invoiceSchema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9\-/_.]{0,29}$/, "Numéro de facture : lettres, chiffres et - / _ . (30 caractères max.)."),
    issueDate: dateIso,
    deliveryDate: dateIso,
    dueDate: dateIso,
    orderDate: dateIso.optional(),
    seller: sellerSchema,
    buyer: buyerSchema,
    lines: z.array(lineSchema).min(1, "Au moins une ligne d'article est requise.").max(60, "60 lignes au plus."),
    shipping: montantLibelle.optional(),
    discounts: z.array(montantLibelle).max(5).default([]),
    taxesIncluded: z.boolean(),
    vatLines: z.array(vatLineSchema).min(1, "Au moins une ligne de TVA (taux et montant fournis par Shopify) est requise."),
    currency: z.literal("CHF", "Seule la devise CHF est acceptée."),
    totalCents: centimes.min(1, "Le total doit être supérieur à zéro."),
    paymentTerms: texte(120),
    orderReference: texte(30).optional(),
    poNumber: texte(40).optional(),
    /** Date de paiement : la facture est alors une facture acquittée (reçu), sans bulletin QR. */
    paidOn: dateIso.optional(),
  })
  .superRefine(verifierCoherence);

/** Données brutes acceptées (avant valeurs par défaut et normalisation). */
export type InvoiceInputRaw = z.input<typeof invoiceSchema>;
/** Facture validée : c'est ce type qu'attend `renderInvoicePdf`. */
export type InvoiceInput = z.output<typeof invoiceSchema>;
export type InvoiceSeller = InvoiceInput["seller"];
export type InvoiceSellerRaw = InvoiceInputRaw["seller"];
export type InvoiceBuyer = InvoiceInput["buyer"];
export type InvoiceLine = InvoiceInput["lines"][number];
export type InvoiceVatLine = InvoiceInput["vatLines"][number];
