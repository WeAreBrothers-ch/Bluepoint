import { success, type Result } from "../core/result";

/**
 * Pagination par curseur avec un plafond strict : on s'arrête dès que `maxItems`
 * éléments sont réunis, et on signale si d'autres pages restaient à lire.
 */

export interface Page<TItem> {
  readonly items: readonly TItem[];
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

export interface Collected<TItem> {
  readonly items: readonly TItem[];
  /** Vrai si le plafond a coupé la lecture : il existe d'autres éléments. */
  readonly truncated: boolean;
}

export type PageFetcher<TItem, TError extends Error> = (
  after: string | null,
  first: number,
) => Promise<Result<Page<TItem>, TError>>;

export async function collectPages<TItem, TError extends Error>(
  fetchPage: PageFetcher<TItem, TError>,
  pageSize: number,
  maxItems: number,
): Promise<Result<Collected<TItem>, TError>> {
  const items: TItem[] = [];
  let after: string | null = null;
  for (;;) {
    const first = Math.min(pageSize, maxItems - items.length);
    const page = await fetchPage(after, first);
    if (!page.ok) return page;
    items.push(...page.value.items);
    const more = page.value.hasNextPage && page.value.endCursor !== null;
    if (!more) return success({ items, truncated: false });
    if (items.length >= maxItems) return success({ items, truncated: true });
    after = page.value.endCursor;
  }
}
