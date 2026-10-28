import type { InvoiceInputRaw } from "../schema";
import { VENDEUR_EXEMPLE } from "./vendeur";

/** Facture saisie directement (sans Shopify), prix TVA comprise. */
export const FACTURE_EXEMPLE: InvoiceInputRaw = {
  invoiceNumber: "BP-2026-0042",
  issueDate: "2026-10-21",
  deliveryDate: "2026-10-20",
  dueDate: "2026-11-20",
  seller: VENDEUR_EXEMPLE,
  buyer: {
    name: "Claire Monnier",
    company: "Restaurant Le Pressoir",
    street: "Chemin des Vignes",
    buildingNumber: "3b",
    postalCode: "1096",
    city: "Cully",
    country: "CH",
  },
  lines: [
    { description: "Merlot del Ticino Picaia 2022", producer: "Bianchi", volumeLabel: "75 cl", quantity: 36, unitPriceCents: 2400, totalCents: 86400 },
    { description: "Alma Bio IGT", producer: "Bianchi", volumeLabel: "75 cl", quantity: 24, unitPriceCents: 2800, totalCents: 67200 },
  ],
  shipping: { label: "Livraison", amountCents: 1500 },
  discounts: [],
  taxesIncluded: true,
  vatLines: [{ ratePercent: 8.1, amountCents: 11622 }],
  currency: "CHF",
  totalCents: 155100,
  paymentTerms: "Payable à 30 jours",
  orderReference: "#1042",
};
