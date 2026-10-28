import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AutomationFields, PaymentFields, SellerFields } from "../components/reglages/SettingsFields";
import { logError } from "../lib/core/logger.server";
import { toFormValues, type SettingsActionResult, type SettingsFormValues } from "../lib/reglages/form-values";
import { formDataToRecord, parseSettings } from "../lib/reglages/schema";
import { completeSettings } from "../lib/reglages/seller";
import { loadStoredSettings, saveSettings } from "../lib/reglages/settings.server";

/** Réglages de facturation : coordonnées du vendeur, compte bancaire, automatismes. */

interface ReglagesLoaderData {
  readonly values: SettingsFormValues;
  readonly complete: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReglagesLoaderData> => {
  const { session } = await authenticate.admin(request);
  const stored = await loadStoredSettings(session.shop);
  return { values: toFormValues(stored), complete: completeSettings(stored) !== null };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<SettingsActionResult> => {
  const { session } = await authenticate.admin(request);
  const parsed = parseSettings(formDataToRecord(await request.formData()));
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors, message: "Certains champs sont à corriger." };
  }
  try {
    await saveSettings(session.shop, parsed.values);
    return { ok: true };
  } catch (error) {
    logError("Enregistrement des réglages impossible", error, { shop: session.shop });
    return { ok: false, errors: {}, message: "Les réglages n’ont pas pu être enregistrés. Réessayez." };
  }
};

export default function ReglagesPage() {
  const { values, complete } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const saving = useNavigation().state === "submitting";
  const errors = result !== undefined && !result.ok ? result.errors : {};

  return (
    <s-page heading="Réglages" inlineSize="base">
      {result?.ok ? <s-banner tone="success" heading="Réglages enregistrés." /> : null}
      {result !== undefined && !result.ok ? <s-banner tone="critical" heading={result.message} /> : null}
      {!complete && result === undefined ? (
        <s-banner tone="info" heading="Réglages à compléter">
          Les factures ne sont créées qu’une fois toutes ces informations enregistrées.
        </s-banner>
      ) : null}
      <Form method="post">
        <SellerFields values={values} errors={errors} />
        <PaymentFields values={values} errors={errors} />
        <AutomationFields values={values} />
        <s-stack direction="inline" justifyContent="end" padding="base none">
          <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
            Enregistrer
          </s-button>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
