import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { saveProRequest } from "../lib/pros/repository.server";
import { EMPTY_PRO_REQUEST, isRobot, parseProRequest, readProRequestForm } from "../lib/pros/request";
import { proFormPage, proThanksPage, proUnavailablePage } from "../lib/pros/storefront-form";

/**
 * Proxy d'app : https://<boutique>/apps/bon-commande/* arrive ici (signature Shopify vérifiée).
 * - /apps/bon-commande/devenir-pro : formulaire « Devenir client pro », affiché dans le thème du site ;
 *   la demande arrive dans l'app (page « Clients pro »).
 * - tout le reste mène au panier : le bon de commande passe par le paiement normal de Shopify
 *   (pro rattaché à une entreprise avec « paiement à 30 jours »).
 */

const PRO_FORM_PATH = "devenir-pro";

function isProFormPath(splat: string | undefined): boolean {
  return (splat ?? "").replace(/\/+$/, "") === PRO_FORM_PATH;
}

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<Response> => {
  const { liquid } = await authenticate.public.appProxy(request);
  if (!isProFormPath(params["*"])) return redirect("/cart");
  return liquid(proFormPage(EMPTY_PRO_REQUEST, {}, true));
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<Response> => {
  const { liquid } = await authenticate.public.appProxy(request);
  if (!isProFormPath(params["*"])) return redirect("/cart");
  // La boutique vient des paramètres signés par Shopify (vérifiés ci-dessus).
  const shop = new URL(request.url).searchParams.get("shop");
  const form = await request.formData();
  if (shop === null) return liquid(proUnavailablePage());
  if (isRobot(form)) return liquid(proThanksPage());
  const parsed = parseProRequest(readProRequestForm(form));
  if (!parsed.ok) return liquid(proFormPage(parsed.values, parsed.errors, false));
  try {
    const saved = await saveProRequest(shop, parsed.value, "site");
    if (!saved.ok) return liquid(proUnavailablePage());
    logInfo("Demande de compte pro reçue", { shop, requestId: saved.id });
    return liquid(proThanksPage());
  } catch (error) {
    logError("Demande de compte pro non enregistrée", error, { shop });
    return liquid(proUnavailablePage());
  }
};
