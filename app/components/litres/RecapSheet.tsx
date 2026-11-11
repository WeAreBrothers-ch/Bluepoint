import { formatBottles, formatLiters } from "../../lib/litres/report";
import type { LitresPageData } from "../../lib/litres/report.server";
import { CategoryTable, LITRES_TABLE_STYLE, MonthTable, WineTable } from "./LitresTables";

/**
 * Feuille de récapitulatif des litres vendus, faite pour être imprimée (A4) : en-tête, trois tableaux,
 * méthode de calcul, ligne de signature. Les boutons disparaissent à l'impression.
 */

const SHEET_STYLE = `
.recap { max-width: 190mm; margin: 0 auto; padding: 16px; color: #1a1a1a; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.recap h1 { font-size: 22px; margin: 0 0 4px; }
.recap h2 { font-size: 16px; margin: 22px 0 8px; }
.recap .meta { color: #555; font-size: 14px; margin: 2px 0; }
.recap .total { font-size: 28px; font-weight: 700; margin: 12px 0 2px; }
.recap .warn { border: 2px solid #b54708; padding: 8px 12px; margin: 12px 0; font-weight: 600; }
.recap .notes { font-size: 13px; color: #333; margin: 6px 0; }
.recap .sign { display: flex; gap: 32px; margin-top: 36px; font-size: 14px; }
.recap .sign div { flex: 1; border-top: 1px solid #333; padding-top: 6px; }
.recap table { page-break-inside: avoid; margin-bottom: 18px; }
.recap-actions { display: flex; gap: 8px; max-width: 190mm; margin: 12px auto 0; padding: 0 16px; }
@page { size: A4; margin: 14mm; }
@media print {
  .recap-actions { display: none !important; }
  .recap { max-width: none; padding: 0; }
}
`;

const DATE_FORMAT = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });

export function RecapSheet({ data }: { readonly data: LitresPageData }) {
  const { report, year } = data;
  return (
    <>
      <style>{LITRES_TABLE_STYLE + SHEET_STYLE}</style>
      <div className="recap-actions">
        <s-button variant="primary" icon="print" onClick={() => window.print()}>
          Imprimer
        </s-button>
        <s-button href={`/app/litres?annee=${year}`}>Retour</s-button>
      </div>
      <div className="recap">
        <h1>{`Litres de vin vendus en ${year}`}</h1>
        <p className="meta">{data.sellerName ?? "BluePoint Distribution"}</p>
        <p className="meta">{`Du 1er janvier au 31 décembre ${year} (heure suisse) · établi le ${DATE_FORMAT.format(new Date(data.generatedAt))}`}</p>
        {report === null ? (
          <p className="warn">{data.loadError ?? "Les commandes n’ont pas pu être lues. Revenez à la page et réessayez."}</p>
        ) : (
          <>
            {data.partial ? (
              <p className="warn">
                Chiffres incomplets : Shopify ne donne que les 60 derniers jours de commandes à l’app. Ne pas utiliser pour une déclaration.
              </p>
            ) : null}
            {data.truncated ? <p className="warn">Chiffres incomplets : il y a trop de commandes pour les compter toutes.</p> : null}
            {report.assumedBottles > 0 || report.incomplete.length > 0 ? (
              <p className="warn">
                À vérifier : {report.incomplete.length} vin{report.incomplete.length > 1 ? "s" : ""} sans contenance ou sans pays (
                {formatBottles(report.assumedBottles)} comptées à 75 cl).
              </p>
            ) : null}
            <div className="total">{formatLiters(report.totals.wineMl)}</div>
            <p className="meta">{`${formatBottles(report.totals.wineBottles)} de vin vendues, dans ${data.orderCount} commande${data.orderCount > 1 ? "s" : ""}.`}</p>
            {report.totals.spiritsBottles === 0 ? null : (
              <p className="meta">{`Hors vin, à part : spiritueux ${formatLiters(report.totals.spiritsMl)} (${formatBottles(report.totals.spiritsBottles)}).`}</p>
            )}
            <h2>Par sorte et par pays</h2>
            <CategoryTable report={report} />
            <h2>Vin par vin</h2>
            <WineTable report={report} />
            <h2>Mois par mois</h2>
            <MonthTable report={report} />
            <p className="notes">
              Calcul : nombre de bouteilles vendues × contenance de la bouteille, commande par commande. Commandes annulées et commandes d’essai
              non comptées ; remboursements non déduits. Le champagne est compté comme venant de France.
            </p>
            <div className="sign">
              <div>Établi par</div>
              <div>Date et signature</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
