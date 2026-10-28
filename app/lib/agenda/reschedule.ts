import { dateMetafield, type MetafieldValueInput } from "../commande/payload";
import { LIVRAISON_KEYS, parseIsoDate, type IsoDate } from "../metafields/definitions";
import { addDays, longDay } from "./dates";

/**
 * « Choisir le jour » d'une commande dans l'agenda (logique pure).
 * Sert surtout aux commandes du site arrivées sans date : on appelle le client, on choisit le jour.
 */

export type NewDayCheck = { readonly ok: true; readonly date: IsoDate } | { readonly ok: false; readonly message: string };

export function checkNewDay(value: unknown, today: IsoDate): NewDayCheck {
  const date = parseIsoDate(value);
  if (date === null) return { ok: false, message: "Choisissez un jour dans le calendrier." };
  if (date < today) return { ok: false, message: "Ce jour est déjà passé\u202F: choisissez aujourd’hui ou un jour qui vient." };
  return { ok: true, date };
}

/**
 * Métachamps à écrire. Une fois les métachamps posés, l'agenda ne lit plus les attributs du panier :
 * la date limite connue est donc recopiée, et repoussée au jour choisi si elle tombait avant.
 */
export function rescheduleMetafields(date: IsoDate, currentDeadline: IsoDate | null): MetafieldValueInput[] {
  const fields = [dateMetafield(LIVRAISON_KEYS.dateSouhaitee, date)];
  if (currentDeadline !== null) {
    fields.push(dateMetafield(LIVRAISON_KEYS.dateLimite, currentDeadline < date ? date : currentDeadline));
  }
  return fields;
}

/** Ex. « C’est noté : prévue demain (jeudi 29 octobre). » */
export function rescheduledMessage(date: IsoDate, today: IsoDate): string {
  const when = date === today ? "aujourd’hui" : date === addDays(today, 1) ? `demain (${longDay(date)})` : `le ${longDay(date)}`;
  return `C’est noté\u202F: prévue ${when}.`;
}
