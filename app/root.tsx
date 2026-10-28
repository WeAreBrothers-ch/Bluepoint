import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";
import { PlainProblemPage } from "./components/ProblemPage";

export function Layout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="fr-CH">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// Dernier filet : une page en français plutôt que la page d'erreur anglaise de React Router.
export function ErrorBoundary() {
  const error = useRouteError();
  return <PlainProblemPage notFound={isRouteErrorResponse(error) && error.status === 404} />;
}
