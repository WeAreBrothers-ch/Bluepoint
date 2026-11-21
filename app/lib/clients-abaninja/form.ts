import { isUuid } from "../abaninja/uuid";

/** Boutons de la page « Clients AbaNinja » : ce que le formulaire demande, vérifié avant toute lecture. */

const CUSTOMER_GID = /^gid:\/\/shopify\/Customer\/\d{1,20}$/;

export type ClientsAbaNinjaIntent =
  | { readonly intent: "relier" | "pas_lui"; readonly fiche: string; readonly client: string }
  | { readonly intent: "creer" | "ignorer" | "remettre"; readonly fiche: string }
  | { readonly intent: "relier_tous" | "creer_tous" };

interface FormLike {
  get(name: string): FormDataEntryValue | null;
}

function text(form: FormLike, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : null;
}

function cardUuid(form: FormLike): string | null {
  const value = text(form, "fiche");
  return value !== null && isUuid(value) ? value.toLowerCase() : null;
}

export function parseAbaNinjaClientsForm(form: FormLike): ClientsAbaNinjaIntent | null {
  const intent = text(form, "intent");
  if (intent === "relier_tous" || intent === "creer_tous") return { intent };
  const fiche = cardUuid(form);
  if (fiche === null) return null;
  if (intent === "creer" || intent === "ignorer" || intent === "remettre") return { intent, fiche };
  if (intent !== "relier" && intent !== "pas_lui") return null;
  const client = text(form, "client");
  return client !== null && CUSTOMER_GID.test(client) ? { intent, fiche, client } : null;
}
