import { calculateQRReferenceChecksum, calculateSCORReferenceChecksum } from "swissqrbill/utils";
import { FactureError } from "./erreurs";

export type TypeReference = "QRR" | "SCOR";

export interface ReferencePaiement {
  type: TypeReference;
  /** Référence sans espaces, telle qu'encodée dans le code QR. */
  valeur: string;
}

/** Longueur du corps d'une référence QR (27 chiffres dont 1 de contrôle). */
const LONGUEUR_QRR = 26;
/** Une référence RF compte au plus 25 caractères : « RF » + 2 chiffres de contrôle + 21. */
const LONGUEUR_MAX_SCOR = 21;

function chiffresDuNumero(numero: string): string {
  const chiffres = numero.replace(/\D/g, "");
  if (!/[1-9]/.test(chiffres)) {
    throw new FactureError(
      `Le numéro de facture « ${numero} » doit contenir au moins un chiffre non nul pour créer la référence de paiement.`,
    );
  }
  return chiffres;
}

/**
 * Référence QR (QRR), obligatoire avec un QR-IBAN : 26 chiffres tirés du numéro de facture,
 * complétés par des zéros à gauche, + 1 chiffre de contrôle (modulo 10 récursif).
 * Ex. BP-2026-0042 → 00000000000000000020260042 + contrôle.
 */
export function referenceQrr(numero: string): string {
  const chiffres = chiffresDuNumero(numero);
  if (chiffres.length > LONGUEUR_QRR) {
    throw new FactureError(`Le numéro « ${numero} » compte trop de chiffres pour une référence QR (26 max.).`);
  }
  const corps = chiffres.padStart(LONGUEUR_QRR, "0");
  return `${corps}${calculateQRReferenceChecksum(corps)}`;
}

/**
 * Référence structurée ISO 11649 (« RF… »), utilisée avec un IBAN classique.
 * Ex. BP-2026-0042 → RF..20260042.
 */
export function referenceScor(numero: string): string {
  const chiffres = chiffresDuNumero(numero);
  if (chiffres.length > LONGUEUR_MAX_SCOR) {
    throw new FactureError(`Le numéro « ${numero} » compte trop de chiffres pour une référence RF (21 max.).`);
  }
  return `RF${calculateSCORReferenceChecksum(chiffres)}${chiffres}`;
}

/** QR-IBAN → référence QR ; IBAN classique → référence RF. La référence revient telle quelle sur le relevé bancaire. */
export function referencePaiement(numero: string, avecQrIban: boolean): ReferencePaiement {
  return avecQrIban
    ? { type: "QRR", valeur: referenceQrr(numero) }
    : { type: "SCOR", valeur: referenceScor(numero) };
}
