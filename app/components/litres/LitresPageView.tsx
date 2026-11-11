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
        <s-button key={value} href={`/app/litres?annee=${value}`} variant="secondary" {...(value === year ? { icon: "check" as const } : {})}>
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
          Pour l’instant, l’application ne voit que les deux derniers mois de commandes. Ne vous servez pas de ces chiffres pour une
          déclaration. La personne qui s’occupe de l’application peut régler ça une fois pour toutes.
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
