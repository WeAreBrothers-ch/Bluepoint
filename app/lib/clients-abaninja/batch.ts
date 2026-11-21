/** Lots « Relier les N » et « Créer les N » : 15 fiches au plus, 45 s au plus par clic, puis on dit ce qui reste. */

export const BATCH_MAX_ITEMS = 15;
export const BATCH_BUDGET_MS = 45_000;

export interface Outcome {
  readonly ok: boolean;
  readonly message: string;
}

export interface BatchReport {
  readonly done: number;
  readonly failures: readonly { readonly name: string; readonly message: string }[];
  readonly remaining: number;
}

export async function runBatch<TItem>(
  items: readonly TItem[],
  nameOf: (item: TItem) => string,
  run: (item: TItem) => Promise<Outcome>,
  now: () => number = Date.now,
): Promise<BatchReport> {
  const startedAt = now();
  let done = 0;
  const failures: { name: string; message: string }[] = [];
  let index = 0;
  for (; index < items.length && index < BATCH_MAX_ITEMS && now() - startedAt < BATCH_BUDGET_MS; index += 1) {
    const item = items[index] as TItem;
    const outcome = await run(item);
    if (outcome.ok) done += 1;
    else failures.push({ name: nameOf(item), message: outcome.message });
  }
  return { done, failures, remaining: items.length - index };
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** « 12 fiches reliées. 1 n’a pas marché (Hôtel du Parc : …). Encore 30 : touchez à nouveau le bouton. » */
export function batchMessage(report: BatchReport, verb: "reliée" | "créée"): string {
  const parts = [`${plural(report.done, "fiche", "fiches")} ${verb}${report.done > 1 ? "s" : ""}.`];
  const first = report.failures[0];
  if (first !== undefined) {
    const count = report.failures.length;
    parts.push(`${count} ${count > 1 ? "n’ont" : "n’a"} pas marché (${first.name}\u202F: ${first.message}).`);
  }
  if (report.remaining > 0) parts.push(`Encore ${report.remaining}\u202F: touchez à nouveau le bouton.`);
  return parts.join(" ");
}
