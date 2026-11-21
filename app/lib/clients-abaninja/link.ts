import { z } from "zod";
import { isUuid } from "../abaninja/uuid";

/**
 * Lien entre une fiche AbaNinja et la boutique, gardé dans des métachamps Shopify de l'app (espace `$app`) :
 * sur le client et sur son entreprise (`abaninja`), les fiches refusées sur le client (`abaninja_refus`),
 * les fiches à ne pas reprendre sur la boutique (`abaninja_ignores`). Aucune table en base.
 */

export const ABANINJA_NAMESPACE = "$app";
export const LINK_KEY = "abaninja";
export const REFUSED_KEY = "abaninja_refus";
export const IGNORED_KEY = "abaninja_ignores";

export type CardKind = "company" | "person";

export interface AbaNinjaLink {
  readonly uuid: string;
  readonly kind: CardKind;
  readonly number: string | null;
}

const linkSchema = z.object({
  uuid: z.string().refine(isUuid).transform((uuid) => uuid.toLowerCase()),
  kind: z.enum(["company", "person"]),
  number: z.string().max(40).nullable(),
});

function readJson(value: string | null | undefined): unknown {
  if (value === null || value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function parseLink(value: string | null | undefined): AbaNinjaLink | null {
  const parsed = linkSchema.safeParse(readJson(value));
  return parsed.success ? parsed.data : null;
}

export function serializeLink(link: AbaNinjaLink): string {
  return JSON.stringify({ uuid: link.uuid, kind: link.kind, number: link.number });
}

export function parseUuidList(value: string | null | undefined): string[] {
  const json = readJson(value);
  if (!Array.isArray(json)) return [];
  const uuids = json.filter((item): item is string => typeof item === "string" && isUuid(item)).map((uuid) => uuid.toLowerCase());
  return [...new Set(uuids)];
}

export function serializeUuidList(uuids: readonly string[]): string {
  return JSON.stringify([...new Set(uuids.map((uuid) => uuid.toLowerCase()))]);
}
