import type { RetiredWine } from "../../lib/stock/retire";

/** En bas de la page Stock : les vins retirés de la vente, avec « Remettre en vente ». */

interface RetiredWinesProps {
  readonly wines: readonly RetiredWine[];
  readonly canRestore: boolean;
  readonly onRestore: (wine: RetiredWine) => void;
  /** Vin en train d'être remis en vente. */
  readonly restoring: string | null;
}

export function RetiredWines({ wines, canRestore, onRestore, restoring }: RetiredWinesProps) {
  if (wines.length === 0) return null;
  return (
    <s-section heading={`Vins retirés de la vente (${wines.length})`}>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">Ils ne sont plus sur le site ni dans « Prendre une commande ». Leurs ventes passées sont gardées.</s-text>
        {wines.map((wine) => (
          <s-stack key={wine.productId} direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {wine.imageUrl === null ? <s-thumbnail alt="" size="small" /> : <s-thumbnail src={wine.imageUrl} alt="" size="small" />}
              <s-text type="strong">{wine.title}</s-text>
            </s-stack>
            {canRestore ? (
              <s-button icon="undo" onClick={() => onRestore(wine)} {...(restoring === wine.productId ? { loading: true } : {})}>
                Remettre en vente
              </s-button>
            ) : null}
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  );
}
