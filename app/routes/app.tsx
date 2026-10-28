import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { isRouteErrorResponse, Outlet, useLoaderData, useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { ProblemPanel } from "../components/ProblemPage";
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

function AppNav() {
  return (
    <s-app-nav>
      <s-link href="/app">
        Agenda
      </s-link>
      <s-link href="/app/commande">Prendre une commande</s-link>
      <s-link href="/app/factures">Factures</s-link>
      <s-link href="/app/pros">Clients pro</s-link>
      <s-link href="/app/reglages">Réglages</s-link>
    </s-app-nav>
  );
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <AppNav />
      <Outlet />
    </AppProvider>
  );
}

/**
 * Les réponses lancées par l'authentification Shopify passent par `boundary.error` (elle en a besoin).
 * Une vraie panne d'une page garde le menu et affiche un message simple en français.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData<typeof loader>("routes/app");
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (isRouteErrorResponse(error) && !notFound) return boundary.error(error);
  // Sans clé API, pas de menu possible : la page d'erreur générale prend le relais.
  if (data === undefined) throw error;
  return (
    <AppProvider apiKey={data.apiKey}>
      <AppNav />
      <ProblemPanel notFound={notFound} />
    </AppProvider>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
