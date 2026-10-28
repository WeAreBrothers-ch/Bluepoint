import { normalizePhoneE164 } from "../factures/phone";
import type { DeliveryTask } from "./types";

/** Adresse, itinéraire et téléphone d'une livraison, prêts à afficher et à toucher. */

type Place = Pick<DeliveryTask, "street" | "zip" | "city">;

/** Ex. « Quai Fictif 12, 1095 Lutry » ; `null` sans rue ni localité. */
export function addressText(place: Place): string | null {
  const town = [place.zip, place.city].filter((part) => part !== null).join(" ");
  const parts = [place.street, town === "" ? null : town].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(", ");
}

/** Itinéraire Google Maps depuis l'endroit où l'on se trouve (ouvre l'app Plans/Maps sur téléphone). */
export function directionsUrl(place: Place): string | null {
  const address = addressText(place);
  if (address === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, Suisse`)}`;
}

/** Lien d'appel ; `null` si le numéro est illisible. */
export function phoneHref(raw: string | null): string | null {
  const phone = normalizePhoneE164(raw);
  return phone === null ? null : `tel:${phone}`;
}

/** Numéro suisse écrit à la suisse : « +41791234567 » → « 079 123 45 67 ». Autres numéros inchangés. */
export function phoneDisplay(raw: string): string {
  const phone = normalizePhoneE164(raw);
  if (phone === null || !phone.startsWith("+41")) return raw.trim();
  const national = `0${phone.slice(3)}`;
  return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`;
}
