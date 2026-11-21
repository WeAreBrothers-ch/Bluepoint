import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ClientsAbaNinjaResult } from "../../lib/clients-abaninja/actions.server";

/**
 * Un seul envoi à la fois pour toute la page : pendant qu'un bouton travaille, les autres attendent
 * (pas deux écritures croisées sur la même fiche). Chaque carte retrouve ainsi le résultat qui la concerne.
 */

const ACTION_KEY = "clients-abaninja";

export interface ClientsAction {
  readonly busy: boolean;
  /** La fiche (ou le lot) en cours d'envoi : son bouton tourne. */
  readonly pendingIntent: string | null;
  readonly pendingFiche: string | null;
  readonly pendingClient: string | null;
  readonly result: ClientsAbaNinjaResult | undefined;
  readonly submit: (values: Readonly<Record<string, string>>) => void;
}

function field(form: FormData | undefined, name: string): string | null {
  const value = form?.get(name);
  return typeof value === "string" ? value : null;
}

export function useClientsAction(): ClientsAction {
  const fetcher = useFetcher<ClientsAbaNinjaResult>({ key: ACTION_KEY });
  const busy = fetcher.state !== "idle";
  const form = busy ? fetcher.formData : undefined;
  return {
    busy,
    pendingIntent: field(form, "intent"),
    pendingFiche: field(form, "fiche"),
    pendingClient: field(form, "client"),
    result: busy ? undefined : fetcher.data,
    submit: (values) => void fetcher.submit({ ...values }, { method: "post" }),
  };
}

/**
 * Le résultat s'annonce aussi en bas de l'écran, où qu'on soit dans la page : une réussite (la fiche quitte sa place
 * pour son nouveau groupe) ou la fin d'un lot, même en partie refusé.
 */
export function useResultToast(result: ClientsAbaNinjaResult | undefined): void {
  const shopify = useAppBridge();
  useEffect(() => {
    if (result === undefined) return;
    const batch = result.intent === "relier_tous" || result.intent === "creer_tous";
    if (result.ok || batch) shopify.toast.show(result.message, { duration: 8000, isError: !result.ok });
  }, [result, shopify]);
}
