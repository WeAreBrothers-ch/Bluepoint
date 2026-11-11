import { TITRES } from "./titres";

/**
 * D'où l'on vient quand on ouvre une fiche commande : le bouton « Retour » ramène au même endroit,
 * avec le même nom que dans le menu. Le lien vers la fiche porte « ?depuis=… ».
 */

export const ORIGINS = ["livraisons", "factures", "commandes", "client"] as const;
export type Origin = (typeof ORIGINS)[number];

export interface BackLink {
  readonly href: string;
  readonly label: string;
}

const BACK: Readonly<Record<Exclude<Origin, "client">, BackLink>> = {
  livraisons: { href: "/app", label: `Retour aux ${TITRES.livraisons.toLowerCase()}` },
  factures: { href: "/app/factures", label: `Retour aux ${TITRES.factures.toLowerCase()}` },
  commandes: { href: "/app/commandes", label: "Retour à la liste des commandes" },
};

const NUMERIC_ID = /^\d{1,20}$/;

/** `clientId` : numéro du client quand on vient de sa fiche. */
export function backLink(origin: string | null, clientId: string | null = null): BackLink {
  if (origin === "client" && clientId !== null && NUMERIC_ID.test(clientId)) {
    return { href: `/app/clients/${clientId}`, label: "Retour à la fiche du client" };
  }
  const known = ORIGINS.find((value): value is Exclude<Origin, "client"> => value === origin && value !== "client");
  return BACK[known ?? "livraisons"];
}

/** Lien vers la fiche d'une commande, en se souvenant d'où l'on vient (et de quel client). */
export function orderHref(numericId: string, origin: Origin, clientId: string | null = null): string {
  const client = origin === "client" && clientId !== null ? `&client=${clientId}` : "";
  return `/app/commandes/${numericId}?depuis=${origin}${client}`;
}
