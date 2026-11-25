import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { AccueilPage, ACCUEIL_TEXTES } from "../../components/accueil/AccueilPage";
import { findInstalledShop, logBareVisit } from "../../lib/accueil/accueil.server";
import { entryLinks, shopEntry, type EntryLink } from "../../lib/accueil/entree-app";
import { readRequiredEnv } from "../../lib/core/env.server";

/**
 * Page publique de l'app. Ouverte par Shopify (paramètre `shop`), elle passe tout de suite à l'app intégrée ;
 * sinon elle montre comment rentrer dans l'app, page par page (voir `AccueilPage`).
 */

interface AccueilData {
  readonly links: readonly EntryLink[] | null;
}

export const meta: MetaFunction = () => [{ title: ACCUEIL_TEXTES.titre }];

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AccueilData> => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  logBareVisit(request);
  const entry = shopEntry(await findInstalledShop());
  // La clé API (publique) sert à l'adresse de l'app dans l'admin Shopify ; le secret ne quitte jamais le serveur.
  return { links: entry === null ? null : entryLinks(entry, readRequiredEnv("SHOPIFY_API_KEY")) };
};

export default function Accueil() {
  const { links } = useLoaderData<typeof loader>();
  return <AccueilPage links={links} />;
}
