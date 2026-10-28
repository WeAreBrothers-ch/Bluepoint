import type { InvoiceSellerRaw } from "../schema";

/**
 * Coordonnées de BluePoint Distribution pour les tests et l'exemple.
 * ⚠ Numéro TVA et IBAN FICTIFS (valeurs d'exemple officielles) : à remplacer par ceux du client.
 */
export const VENDEUR_EXEMPLE: InvoiceSellerRaw = {
  name: "BluePoint Distribution",
  street: "Rue du Châtelard",
  buildingNumber: "44",
  postalCode: "1095",
  city: "Lutry",
  country: "CH",
  vatNumber: "CHE-123.456.788 TVA",
  iban: "CH93 0076 2011 6238 5295 7",
  email: "info@bluepointdistribution.com",
  phone: "+41 79 606 33 22",
};

/** QR-IBAN d'exemple publié par SIX (identifiant bancaire 30000 à 31999). */
export const QR_IBAN_EXEMPLE = "CH44 3199 9123 0008 8901 2";
