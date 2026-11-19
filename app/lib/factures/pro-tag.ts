/** Un pro est un client marqué « pro » (c'est aussi ce qui donne droit aux prix pro). Fonction pure. */

export const PRO_TAG = "pro";

export function hasProTag(tags: readonly string[]): boolean {
  return tags.some((tag) => tag.trim().toLowerCase() === PRO_TAG);
}
