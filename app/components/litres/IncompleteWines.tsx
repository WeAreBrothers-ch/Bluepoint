import { useFetcher } from "react-router";
import { BOTTLE_SIZE_CHOICES, COUNTRY_CHOICES } from "../../lib/stock/new-wine";
import { formatBottles, type IncompleteWine } from "../../lib/litres/report";
import type { WineInfoResult } from "../../lib/litres/info-form";
import { DEFAULT_BOTTLE_CL } from "../../lib/litres/wine-info";

/**
 * Les vins vendus dont il manque le pays ou la contenance : un petit formulaire par vin.
 * Une fois enregistré, le vin garde ces informations (étiquettes Shopify) et les totaux se recalculent.
 */

function Row({ wine }: { readonly wine: IncompleteWine }) {
  const fetcher = useFetcher<WineInfoResult>({ key: `infos-vin-${wine.productId}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const needsCountry = wine.missing.includes("pays");
  const needsSize = wine.missing.includes("contenance");

  return (
    <s-box padding="base" border="base" borderRadius="base" background="base">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="infos_vin" />
        <input type="hidden" name="productId" value={wine.productId} />
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{wine.title}</s-text>
          <s-text color="subdued">{`${wine.category} · ${formatBottles(wine.bottles)} vendues cette année`}</s-text>
          <s-stack direction="inline" gap="small-200" alignItems="end">
            {needsCountry ? (
              <s-select label="Pays" name="country" value="">
                <s-option value="">Choisir le pays…</s-option>
                {COUNTRY_CHOICES.map((country) => (
                  <s-option key={country} value={country}>
                    {country}
                  </s-option>
                ))}
              </s-select>
            ) : null}
            {needsSize ? (
              <s-select label="Contenance d’une bouteille" name="size" value={String(DEFAULT_BOTTLE_CL)}>
                {BOTTLE_SIZE_CHOICES.map((size) => (
                  <s-option key={size.value} value={size.value}>
                    {size.label}
                  </s-option>
                ))}
              </s-select>
            ) : null}
            <s-button type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
              Enregistrer
            </s-button>
          </s-stack>
          {result === undefined ? null : <s-banner tone={result.ok ? "success" : "critical"} heading={result.message} />}
        </s-stack>
      </fetcher.Form>
    </s-box>
  );
}

export function IncompleteWines({ wines, assumedBottles }: { readonly wines: readonly IncompleteWine[]; readonly assumedBottles: number }) {
  if (wines.length === 0) return null;
  const sizes = wines.filter((wine) => wine.missing.includes("contenance")).length;
  const countries = wines.filter((wine) => wine.missing.includes("pays")).length;
  return (
    <s-section heading="Des vins sont à compléter">
      <s-stack direction="block" gap="base">
        <s-banner tone="warning" heading="Les totaux ne sont pas encore sûrs">
          <s-stack direction="block" gap="small-200">
            {sizes === 0 ? null : (
              <s-text>{`${sizes} vin${sizes > 1 ? "s" : ""} sans contenance\u202F: ${formatBottles(assumedBottles)} comptées à 75\u00A0cl en attendant.`}</s-text>
            )}
            {countries === 0 ? null : <s-text>{`${countries} vin${countries > 1 ? "s" : ""} sans pays\u202F: ils sont classés « Pays non renseigné ».`}</s-text>}
            <s-text>Choisissez ce qui manque pour chaque vin : c’est enregistré une fois pour toutes.</s-text>
          </s-stack>
        </s-banner>
        {wines.map((wine) => (
          <Row key={wine.productId} wine={wine} />
        ))}
      </s-stack>
    </s-section>
  );
}
