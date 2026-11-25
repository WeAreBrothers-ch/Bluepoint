import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../../core/logger.server";
import { EMPTY_FICHE, parseFiche, readFicheForm, type FicheErrors, type FicheValues } from "./form";
import { ficheDonePage, ficheFormPage, ficheLoginPage, ficheNotProPage, ficheUnavailablePage } from "./page";
import { planFiche } from "./plan";
import { customerGid, readFiche, writeFiche } from "./shopify.server";
import { missingParts, type FicheState } from "./state";

/**
 * /apps/bon-commande/ma-fiche : le pro connecté complète ce qui manque à sa fiche (nom, téléphone, adresse de livraison).
 * Le client vient de `logged_in_customer_id`, que Shopify signe avec le reste de l'adresse (signature vérifiée par
 * `authenticate.public.appProxy` avant d'arriver ici) : impossible de viser la fiche d'un autre.
 * Aucune donnée personnelle dans le journal : seulement les identifiants Shopify et les parties complétées.
 */

const PHONE_TAKEN = "Ce numéro est déjà enregistré pour un autre client de la boutique. Indiquez un autre numéro, par exemple votre portable.";

export interface FicheProxyContext {
  readonly liquid: (body: string, init?: ResponseInit) => Response;
  readonly admin: AdminApiContext | undefined;
}

/** Le client connecté (chiffres seulement), ou `null` si personne n'est connecté. */
function loggedInCustomer(request: Request): string | null {
  const id = new URL(request.url).searchParams.get("logged_in_customer_id") ?? "";
  return /^\d+$/.test(id) ? customerGid(id) : null;
}

function formPage(state: FicheState, values: FicheValues, errors: FicheErrors): string {
  return ficheFormPage({ companyName: state.companyName, locationId: state.location.id, parts: missingParts(state) }, values, errors);
}

async function submit(admin: AdminApiContext, state: FicheState, form: FormData): Promise<string> {
  const parts = missingParts(state);
  if (parts.length === 0) return ficheDonePage(state.companyName, true);
  const parsed = parseFiche(parts, readFicheForm(form));
  if (!parsed.ok) return formPage(state, parsed.values, parsed.errors);
  const written = await writeFiche(admin, state.location.id, planFiche(state, parsed.value));
  if (!written.ok && written.error.reason === "phone_taken") return formPage(state, readFicheForm(form), { phone: PHONE_TAKEN });
  if (!written.ok) {
    logError("Fiche pro : enregistrement refusé", written.error, { customerId: state.customerId, locationId: state.location.id });
    return ficheUnavailablePage();
  }
  logInfo("Fiche pro complétée depuis le site", { customerId: state.customerId, locationId: state.location.id, parts: parts.join(",") });
  return ficheDonePage(state.companyName, true);
}

async function body(context: FicheProxyContext, request: Request): Promise<string> {
  const customerId = loggedInCustomer(request);
  if (customerId === null) return ficheLoginPage();
  if (context.admin === undefined) {
    logError("Fiche pro : boutique sans session pour l'app", new Error("Pas de session hors ligne"), { customerId });
    return ficheUnavailablePage();
  }
  const isPost = request.method === "POST";
  const form = isPost ? await request.formData() : null;
  const lieuValue = form === null ? new URL(request.url).searchParams.get("lieu") : form.get("lieu");
  const read = await readFiche(context.admin, customerId, typeof lieuValue === "string" ? lieuValue : null);
  if (!read.ok) {
    logError("Fiche pro : lecture impossible", read.error, { customerId });
    return ficheUnavailablePage();
  }
  const state = read.value;
  if (state === null) return ficheNotProPage();
  if (form !== null) return submit(context.admin, state, form);
  return missingParts(state).length === 0 ? ficheDonePage(state.companyName, false) : formPage(state, EMPTY_FICHE, {});
}

/** Jamais gardée en cache : la page montre la fiche d'un client connecté. */
export async function ficheResponse(context: FicheProxyContext, request: Request): Promise<Response> {
  return context.liquid(await body(context, request), { headers: { "Cache-Control": "no-store" } });
}
