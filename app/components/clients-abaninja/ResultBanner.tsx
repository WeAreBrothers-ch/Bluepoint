import type { ClientsAbaNinjaResult } from "../../lib/clients-abaninja/actions.server";

/** Le résultat du dernier bouton, à l'endroit où il a été touché. */
export function ResultBanner({ result }: { readonly result: ClientsAbaNinjaResult | undefined }) {
  if (result === undefined) return null;
  return <s-banner tone={result.ok ? "success" : "critical"} heading={result.message} />;
}
