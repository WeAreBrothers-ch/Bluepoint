import { formatInteger } from "../../lib/format/money";
import { isWineCategory } from "../../lib/litres/wine-info";
import { formatBottleSize, formatLiters, MONTH_NAMES, type LitresReport } from "../../lib/litres/report";

/**
 * Les tableaux des litres vendus, communs à la page et à la feuille à imprimer :
 * par sorte et par pays, vin par vin, mois par mois. Des tableaux simples, lisibles aussi sur papier.
 */

export const LITRES_TABLE_STYLE = `
.litres-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.35; }
.litres-table th, .litres-table td { padding: 6px 8px; border-bottom: 1px solid #d5d5d5; text-align: left; vertical-align: top; }
.litres-table th { font-weight: 600; border-bottom: 2px solid #8a8a8a; }
.litres-table .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.litres-table tfoot td { font-weight: 700; border-top: 2px solid #8a8a8a; border-bottom: none; }
.litres-table .group td { background: #f4f4f4; font-weight: 600; }
.litres-table .muted { color: #6b6b6b; }
.litres-table .check { color: #b54708; font-weight: 600; }
`;

export function CategoryTable({ report }: { readonly report: LitresReport }) {
  return (
    <table className="litres-table" aria-label="Litres vendus par sorte de vin et par pays">
      <thead>
        <tr>
          <th>Sorte</th>
          <th>Pays</th>
          <th className="num">Bouteilles</th>
          <th className="num">Litres</th>
        </tr>
      </thead>
      <tbody>
        {report.byCategoryCountry.length === 0 ? (
          <tr>
            <td colSpan={4} className="muted">
              Aucun vin vendu sur cette année.
            </td>
          </tr>
        ) : (
          report.byCategoryCountry.map((row) => (
            <tr key={`${row.category}|${row.country}`}>
              <td>{row.category}</td>
              <td>{row.country}</td>
              <td className="num">{formatInteger(row.bottles)}</td>
              <td className="num">{formatLiters(row.ml)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>Total des vins vendus</td>
          <td className="num">{formatInteger(report.totals.wineBottles)}</td>
          <td className="num">{formatLiters(report.totals.wineMl)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function WineTable({ report }: { readonly report: LitresReport }) {
  const wines = report.wines.filter((wine) => wine.category !== "Autre");
  return (
    <table className="litres-table" aria-label="Litres vendus vin par vin">
      <thead>
        <tr>
          <th>Vin</th>
          <th>Sorte</th>
          <th>Pays</th>
          <th className="num">Contenance</th>
          <th className="num">Bouteilles</th>
          <th className="num">Litres</th>
        </tr>
      </thead>
      <tbody>
        {wines.length === 0 ? (
          <tr>
            <td colSpan={6} className="muted">
              Aucun vin vendu sur cette année.
            </td>
          </tr>
        ) : (
          wines.map((wine) => (
            <tr key={wine.key}>
              <td>
                {wine.title}
                {wine.vendor === null && wine.vintage === null && wine.appellation === null ? null : (
                  <div className="muted">{[wine.vendor, wine.appellation, wine.vintage].filter((part) => part !== null).join(" · ")}</div>
                )}
              </td>
              <td>{wine.category}</td>
              <td>{wine.country ?? (isWineCategory(wine.category) ? <span className="check">à compléter</span> : "—")}</td>
              <td className="num">
                {formatBottleSize(wine.bottleMl)}
                {wine.bottleMlAssumed ? <span className="check"> (supposée)</span> : null}
              </td>
              <td className="num">{formatInteger(wine.bottles)}</td>
              <td className="num">{formatLiters(wine.ml)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function MonthTable({ report }: { readonly report: LitresReport }) {
  return (
    <table className="litres-table" aria-label="Litres de vin vendus mois par mois">
      <thead>
        <tr>
          <th>Mois</th>
          <th className="num">Litres</th>
        </tr>
      </thead>
      <tbody>
        {MONTH_NAMES.map((name, index) => (
          <tr key={name}>
            <td>{name.charAt(0).toUpperCase() + name.slice(1)}</td>
            <td className="num">{formatLiters(report.monthlyMl[index] ?? 0)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="num">{formatLiters(report.totals.wineMl)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
