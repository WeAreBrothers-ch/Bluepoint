import { parseGid } from "../shopify/ids";
import { parseBottleSize, WINE_COUNTRIES, type WineTagChanges } from "./wine-info";

/**
 * « Compléter un vin » depuis la page Litres : pays et contenance (et, si on veut, année et appellation).
 * Lecture et vérification du formulaire, messages en français simple (logique pure).
 */

export type WineInfoResult =
  | { readonly ok: true; readonly productId: string; readonly message: string }
  | { readonly ok: false; readonly productId: string; readonly message: string };

export type ParsedWineInfo =
  | { readonly ok: true; readonly productId: string; readonly changes: WineTagChanges }
  | { readonly ok: false; readonly productId: string; readonly message: string };

function text(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function parseWineInfoForm(form: FormData): ParsedWineInfo {
  const rawId = text(form, "productId");
  const productId = parseGid(rawId, "Product");
  if (productId === null) return { ok: false, productId: rawId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };

  const country = text(form, "country");
  const size = text(form, "size");
  const vintage = text(form, "vintage");
  const appellation = text(form, "appellation");
  const changes: { country?: string; bottleMl?: number; vintage?: string; appellation?: string } = {};

  if (country !== "") {
    if (!WINE_COUNTRIES.some((known) => known === country)) return { ok: false, productId, message: "Choisissez le pays dans la liste." };
    changes.country = country;
  }
  if (size !== "") {
    const ml = parseBottleSize(size);
    if (ml === null) return { ok: false, productId, message: "Choisissez la contenance de la bouteille dans la liste." };
    changes.bottleMl = ml;
  }
  if (vintage !== "") {
    if (!/^\d{4}$/.test(vintage)) return { ok: false, productId, message: "L’année s’écrit avec quatre chiffres, par exemple 2022." };
    changes.vintage = vintage;
  }
  if (appellation !== "") {
    if (appellation.length > 80) return { ok: false, productId, message: "L’appellation est trop longue (80 lettres au plus)." };
    changes.appellation = appellation;
  }
  if (Object.keys(changes).length === 0) return { ok: false, productId, message: "Choisissez au moins le pays ou la contenance." };
  return { ok: true, productId, changes };
}
