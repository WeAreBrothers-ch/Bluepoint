import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

/**
 * Page publique de l'app. Ouverte depuis l'admin (paramètre `shop`), elle
 * redirige vers l'app intégrée ; sinon elle propose de se connecter.
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>BluePoint Gestion</h1>
        <p className={styles.text}>
          Agenda des livraisons, commandes par téléphone et factures de BluePoint.
          L’app s’ouvre depuis l’admin Shopify de la boutique.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Adresse de la boutique</span>
              <input className={styles.input} type="text" name="shop" autoComplete="on" />
              <span>ex. nom-de-boutique.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Se connecter
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
