import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { readRequiredEnv } from "../lib/core/env.server";

/** Coque de l'app intégrée : authentification, App Bridge et menu de navigation. */

interface AppLoaderData {
  readonly apiKey: string;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AppLoaderData> => {
  await authenticate.admin(request);
  // La clé API (publique) est nécessaire à App Bridge ; le secret ne quitte jamais le serveur.
  return { apiKey: readRequiredEnv("SHOPIFY_API_KEY") };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">
          Agenda
        </s-link>
        <s-link href="/app/commande">Nouvelle commande</s-link>
        <s-link href="/app/factures">Factures</s-link>
        <s-link href="/app/reglages">Réglages</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify a besoin que React Router intercepte certaines réponses lancées pour en garder les en-têtes.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
