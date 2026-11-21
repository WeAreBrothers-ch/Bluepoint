import { Fragment, useState, type ReactNode } from "react";
import { GroupTitle } from "../GroupTitle";

/**
 * Un groupe de fiches : son titre avec le nombre, une phrase qui dit quoi faire, puis les fiches
 * par paquets de 20 (une liste de plusieurs centaines de fiches reste rapide sur un téléphone).
 */

const STEP = 20;

interface PagedProps<TItem> {
  readonly items: readonly TItem[];
  readonly keyOf: (item: TItem) => string;
  readonly render: (item: TItem) => ReactNode;
}

export function Paged<TItem>({ items, keyOf, render }: PagedProps<TItem>) {
  const [shown, setShown] = useState(STEP);
  const rest = items.length - shown;
  return (
    <>
      {items.slice(0, shown).map((item) => (
        <Fragment key={keyOf(item)}>{render(item)}</Fragment>
      ))}
      {rest > 0 ? (
        <s-button onClick={() => setShown((count) => count + STEP)}>{`Voir ${Math.min(rest, STEP)} fiches de plus (encore ${rest})`}</s-button>
      ) : null}
    </>
  );
}

interface GroupListProps<TItem> extends PagedProps<TItem> {
  readonly title: string;
  readonly hint: string;
  /** Bouton du lot, sous le titre. */
  readonly batch?: ReactNode;
}

export function GroupList<TItem>({ title, hint, batch, ...paged }: GroupListProps<TItem>) {
  if (paged.items.length === 0) return null;
  return (
    <>
      <GroupTitle title={`${title} (${paged.items.length})`} hint={hint} />
      {batch}
      <Paged {...paged} />
    </>
  );
}
