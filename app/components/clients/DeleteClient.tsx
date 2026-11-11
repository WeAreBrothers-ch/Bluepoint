import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { cannotDeleteMessage, type DeleteClientResult } from "../../lib/clients/delete";

/**
 * En bas de la fiche client : « Supprimer ce client », avec deux questions avant d'effacer pour qu'on ne se trompe pas.
 * Un client qui a déjà commandé ne s'efface pas (Shopify garde sa fiche pour les factures) : on l'explique simplement.
 */

interface DeleteClientProps {
  readonly name: string;
  readonly orders: number;
}

type Step = "rien" | "premiere" | "derniere";

export function DeleteClient({ name, orders }: DeleteClientProps) {
  const [step, setStep] = useState<Step>("rien");
  const fetcher = useFetcher<DeleteClientResult>();
  const navigate = useNavigate();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  useEffect(() => {
    // Effacé : retour à la liste des clients, avec le message en haut.
    if (result?.ok) navigate(`/app/clients?supprime=${encodeURIComponent(result.name)}`);
  }, [result, navigate]);

  if (orders > 0) {
    return (
      <s-section heading="Supprimer ce client">
        <s-text color="subdued">{cannotDeleteMessage(orders)}</s-text>
      </s-section>
    );
  }

  return (
    <s-section heading="Supprimer ce client">
      <s-stack direction="block" gap="base">
        {step === "rien" ? (
          <s-stack direction="inline">
            <s-button tone="critical" icon="delete" onClick={() => setStep("premiere")}>
              Supprimer ce client
            </s-button>
          </s-stack>
        ) : null}
        {step === "premiere" ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">{`Supprimer « ${name} »\u202F?`}</s-text>
              <s-text>Sa fiche, son adresse et ses coordonnées seront effacées. S’il est client pro, il perd aussi son accès pro.</s-text>
              <s-stack direction="inline" gap="small-200">
                <s-button variant="primary" tone="critical" icon="delete" onClick={() => setStep("derniere")}>
                  Oui, je veux le supprimer
                </s-button>
                <s-button icon="arrow-left" onClick={() => setStep("rien")}>
                  Non, garder ce client
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        ) : null}
        {step === "derniere" ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">Êtes-vous vraiment sûr ?</s-text>
              <s-text>{`C’est définitif : « ${name} » ne pourra pas être récupéré.`}</s-text>
              <s-stack direction="inline" gap="small-200">
                <s-button
                  variant="primary"
                  tone="critical"
                  icon="delete"
                  onClick={() => fetcher.submit({ intent: "supprimer" }, { method: "post" })}
                  {...(busy ? { loading: true } : {})}
                >
                  Oui, supprimer définitivement
                </s-button>
                <s-button icon="arrow-left" onClick={() => setStep("rien")} {...(busy ? { disabled: true } : {})}>
                  Non, garder ce client
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        ) : null}
        {result !== undefined && !result.ok ? <s-banner tone="critical" heading={result.message} /> : null}
      </s-stack>
    </s-section>
  );
}
