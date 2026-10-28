import { useState } from "react";
import { useFetcher } from "react-router";
import type { ProRequestView, ProsActionResult } from "../../lib/pros/view";

/**
 * Une demande de compte pro : qui, où, comment le joindre, puis « Accepter » ou « Refuser ».
 * Refuser demande une confirmation ; accepter crée tout dans Shopify en un toucher.
 */

function ResultBanner({ result }: { readonly result: ProsActionResult | undefined }) {
  if (result === undefined) return null;
  return <s-banner tone={result.ok ? "success" : "critical"} heading={result.message} />;
}

export function ProRequestCard({ request, canCreate }: { readonly request: ProRequestView; readonly canCreate: boolean }) {
  const fetcher = useFetcher<ProsActionResult>({ key: `pro-${request.id}` });
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const busy = fetcher.state !== "idle";
  const pendingIntent = busy ? fetcher.formData?.get("intent") : null;
  const submit = (intent: "accepter" | "refuser") => fetcher.submit({ intent, requestId: request.id }, { method: "post" });

  return (
    <s-box padding="base" border="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="organization" />
            <s-heading>{request.companyName}</s-heading>
          </s-stack>
          <s-text>{request.personName}</s-text>
          <s-text color="subdued">{request.receivedLabel}</s-text>
        </s-stack>
        <s-stack direction="block" gap="small-100">
          {request.addressLines.map((line) => (
            <s-text key={line}>{line}</s-text>
          ))}
          <s-text>{`${request.email} · ${request.phone}`}</s-text>
          {request.vatNumber === null ? null : <s-text color="subdued">{`TVA\u202F: ${request.vatNumber}`}</s-text>}
        </s-stack>
        {request.message === null ? null : (
          <s-banner tone="info" heading="Son message">
            {request.message}
          </s-banner>
        )}
        {confirmRefuse ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">{`Refuser la demande de ${request.companyName}\u202F?`}</s-text>
              <s-text>Rien ne sera créé dans Shopify. Pensez à prévenir la personne si besoin.</s-text>
              <s-stack direction="inline" gap="small-200">
                <s-button
                  tone="critical"
                  variant="primary"
                  onClick={() => {
                    setConfirmRefuse(false);
                    submit("refuser");
                  }}
                >
                  Oui, refuser
                </s-button>
                <s-button onClick={() => setConfirmRefuse(false)}>Non, annuler</s-button>
              </s-stack>
            </s-stack>
          </s-box>
        ) : (
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="primary"
              icon="check"
              onClick={() => submit("accepter")}
              {...(pendingIntent === "accepter" ? { loading: true } : {})}
              {...(busy || !canCreate ? { disabled: true } : {})}
            >
              Accepter : en faire un client pro
            </s-button>
            <s-button icon="x" onClick={() => setConfirmRefuse(true)} {...(busy ? { disabled: true } : {})}>
              Refuser
            </s-button>
          </s-stack>
        )}
        <ResultBanner result={fetcher.state === "idle" ? fetcher.data : undefined} />
      </s-stack>
    </s-box>
  );
}
