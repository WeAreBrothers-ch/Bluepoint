/**
 * Rabais « paiement par carte tout de suite » : 2 % en plus du prix pro, seulement si le client paie par carte au moment
 * de la commande sur le site. Un paiement plus tard (facture à 30 jours, virement, espèces, TWINT…) n'y donne pas droit.
 * Le rabais est un code de réduction Shopify réservé aux clients pro (voir README, « Rabais carte »).
 */

export const CARD_DISCOUNT_PERCENT = 2;
export const CARD_DISCOUNT_CODE = "CARTE2";

/** Phrase courte, la même partout où le rabais est annoncé. */
export const CARD_DISCOUNT_SENTENCE = `${CARD_DISCOUNT_PERCENT} % de rabais en plus si vous payez par carte tout de suite, au moment de la commande.`;
