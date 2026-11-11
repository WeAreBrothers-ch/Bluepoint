import { TITRES } from "../../lib/titres";
import { formatBottles, formatLiters } from "../../lib/litres/report";
import type { LitresPageData } from "../../lib/litres/report.server";
import { CategoryTable, LITRES_TABLE_STYLE, MonthTable, WineTable } from "./LitresTables";
import { IncompleteWines } from "./IncompleteWines";

/** Page « Litres vendus » : combien de litres de vin ont été vendus dans l'année, par sorte, par pays, par vin et par mois. */

function YearTabs({ year, years }: { readonly year: number; readonly years: readonly number[] }) {
  return (
    <s-stack direction="inline" gap="small-200" accessibilityLabel="Année affichée">
      {years.map((value) => (
        <s-button key={value} href={`/app/litres?annee=${value}`} variant={value === year ? "primary" : "secondary"}>
          {String(value)}
        </s-button>
      ))}
    </s-stack>
  );
}

export function LitresPageView({ data }: { readonly data: LitresPageData }) {
  const { report, year } = data;
  return (
    <s-page heading={TITRES.litres} inlineSize="base">
      <style>{LITRES_TABLE_STYLE}</style>
      {report === null ? null : (
        <s-button slot="primary-action" variant="primary" icon="print" href={`/app/litres/feuille?annee=${year}`}>
          Feuille à imprimer
        </s-button>
      )}
      <YearTabs year={year} years={data.years} />
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.partial ? (
        <s-banner tone="critical" heading="Les litres de cette année ne sont pas complets">
          Shopify ne donne à l’app que les 60 derniers jours de commandes. Pour compter toute l’année, la personne qui s’occupe de l’app doit
          demander à Shopify l’accès à toutes les commandes (autorisation « read_all_orders »). D’ici là, ne vous servez pas de ces chiffres pour
          une déclaration.
        </s-banner>
      ) : null}
      {data.truncated ? (
        <s-banner tone="warning" heading="Il y a trop de commandes pour tout compter d’un coup">
          Seules les premières commandes de l’année sont comptées. Dites-le à la personne qui s’occupe de l’app.
        </s-banner>
      ) : null}
      {report === null ? null : (
        <>
          <s-section heading={`Vin vendu en ${year}`}>
            <s-stack direction="block" gap="small-200">
              <s-heading>{formatLiters(report.totals.wineMl)}</s-heading>
              <s-text color="subdued">
                {`${formatBottles(report.totals.wineBottles)} de vin, dans ${data.orderCount} commande${data.orderCount > 1 ? "s" : ""}. Commandes annulées et d’essai non comptées.`}
              </s-text>
              {report.totals.spiritsBottles === 0 ? null : (
                <s-text color="subdued">{`À part, hors vin\u202F: spiritueux ${formatLiters(report.totals.spiritsMl)} (${formatBottles(report.totals.spiritsBottles)}).`}</s-text>
              )}
            </s-stack>
          </s-section>
          <IncompleteWines wines={report.incomplete} assumedBottles={report.assumedBottles} />
          <s-section heading="Par sorte et par pays">
            <CategoryTable report={report} />
          </s-section>
          <s-section heading="Vin par vin">
            <WineTable report={report} />
          </s-section>
          <s-section heading="Mois par mois">
            <MonthTable report={report} />
          </s-section>
          <s-section heading="Comment c’est calculé">
            <s-stack direction="block" gap="small-200">
              <s-text>Nombre de bouteilles vendues × contenance de la bouteille, commande par commande, du 1er janvier au 31 décembre (heure suisse).</s-text>
              <s-text>Le champagne est toujours compté comme venant de France. Les remboursements ne sont pas déduits.</s-text>
              <s-text>
                Si l’entreprise est suivie par le Contrôle suisse du commerce des vins, le volume de l’année se déclare sur son site avant le 31 janvier de l’année suivante. Voyez avec votre fiduciaire si c’est le cas.
              </s-text>
            </s-stack>
          </s-section>
        </>
      )}
    </s-page>
  );
}
