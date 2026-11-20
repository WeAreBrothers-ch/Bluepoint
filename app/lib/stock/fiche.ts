import {
  BOTTLE_SIZES_CL,
  parseBottleSize,
  plain,
  readWineInfo,
  sizeTagValue,
  WINE_COUNTRIES,
  withWineTags,
} from "../litres/wine-info";

/**
 * « Modifier la fiche » d'un vin depuis la page Stock : nom, producteur, sorte, pays, région, année, appellation,
 * contenance, degré, sticker de la photo, cépages et textes de la fiche du site. Lecture et vérification du formulaire
 * (logique pure).
 *
 * Le site lit ces informations à deux endroits (voir docs/README-boutique.md) :
 * - les étiquettes Shopify (sorte, « pays:… », « region:… », « millesime:… », « appellation:… », « contenance:… ») ;
 * - les métachamps « bluepoint » (ligne « Région » de la fiche, cépages, degré, sticker, dégustation, producteur,
 *   service, conservation).
 * Le prix, la photo et le stock ont leurs propres boutons : ils ne changent pas ici.
 */

/** Les sortes du site (type de produit Shopify). Le champagne est un effervescent avec l'appellation « Champagne ». */
export const FICHE_TYPES = ["Rouge", "Blanc", "Rosé", "Orange", "Effervescent", "Spiritueux"] as const;
export type FicheType = (typeof FICHE_TYPES)[number];

export const FICHE_FIELDS = [
  "title",
  "vendor",
  "type",
  "country",
  "region",
  "vintage",
  "appellation",
  "size",
  "degre",
  "sticker",
  "cepage",
  "regionLine",
  "degustation",
  "producteur",
  "service",
  "conservation",
] as const;
export type FicheField = (typeof FICHE_FIELDS)[number];

/**
 * Ce que montre le sticker posé sur la photo du vin, sur le site (snippets/bp-sticker-vin.liquid) : l'année
 * (« 2023 ») ou le degré d'alcool (« Vol. 13,5 % »). Choisi dans la fiche, enregistré dans le métachamp
 * bluepoint.sticker ; le thème le lit à chaque affichage, donc le sticker suit la fiche dès qu'elle est enregistrée.
 */
export const STICKER_CHOICES = ["annee", "degre"] as const;
export type StickerChoice = (typeof STICKER_CHOICES)[number];

export type FicheValues = Readonly<Record<FicheField, string>>;
export type FicheErrors = Partial<Record<FicheField, string>>;

/** Métachamps « bluepoint » écrits par la fiche, avec leur type Shopify. */
export const FICHE_METAFIELDS = {
  regionLine: { key: "region", type: "single_line_text_field" },
  cepage: { key: "cepage", type: "single_line_text_field" },
  degre: { key: "degre", type: "number_decimal" },
  sticker: { key: "sticker", type: "single_line_text_field" },
  degustation: { key: "degustation", type: "multi_line_text_field" },
  producteur: { key: "producteur", type: "multi_line_text_field" },
  service: { key: "service", type: "multi_line_text_field" },
  conservation: { key: "conservation", type: "multi_line_text_field" },
} as const satisfies Partial<Record<FicheField, { readonly key: string; readonly type: string }>>;

type TextMetafieldField = Exclude<keyof typeof FICHE_METAFIELDS, "degre" | "sticker">;
const TEXT_METAFIELDS: readonly TextMetafieldField[] = ["regionLine", "cepage", "degustation", "producteur", "service", "conservation"];

export const METAFIELD_NAMESPACE = "bluepoint";
export const VOLUME_METAFIELD = { key: "volume_ml", type: "number_integer" } as const;

/** Longueurs maximales, en lettres. */
const MAX_LENGTH: Readonly<Record<FicheField, number>> = {
  title: 120,
  vendor: 120,
  type: 40,
  country: 40,
  region: 80,
  vintage: 4,
  appellation: 80,
  size: 10,
  degre: 6,
  sticker: 10,
  cepage: 200,
  regionLine: 120,
  degustation: 3000,
  producteur: 3000,
  service: 600,
  conservation: 600,
};

/** Ce que Shopify renvoie d'un vin pour remplir la fiche. */
export interface FicheProduct {
  readonly title: string;
  readonly vendor: string;
  readonly productType: string;
  readonly tags: readonly string[];
  readonly metafields: Readonly<Partial<Record<keyof typeof FICHE_METAFIELDS | "volume_ml", string | null>>>;
}

export type FicheLoadResult =
  | {
      readonly ok: true;
      readonly productId: string;
      readonly values: FicheValues;
      /** Les régions déjà dans le menu du site (étiquettes « region:… »), pour écrire la même. */
      readonly regions: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

export type FicheResult =
  | { readonly ok: true; readonly intent: "fiche"; readonly productId: string; readonly message: string }
  | {
      readonly ok: false;
      readonly intent: "fiche";
      readonly productId: string;
      readonly message: string;
      readonly values: FicheValues | null;
      readonly errors: FicheErrors;
    };

/** Contenances proposées (en cl, comme l'étiquette « contenance:75 »). */
export const FICHE_SIZE_CHOICES: readonly { readonly value: string; readonly label: string }[] = BOTTLE_SIZES_CL.map((cl) => ({
  value: sizeTagValue(cl * 10),
  label: cl === 75 ? "75 cl (bouteille habituelle)" : cl === 70 ? "70 cl (bouteille vaudoise)" : cl === 150 ? "150 cl (magnum)" : cl === 300 ? "300 cl (double magnum)" : `${String(cl).replace(".", ",")} cl`,
}));

const TYPE_TAGS = new Set(["rouge", "blanc", "rose", "orange", "effervescent", "spiritueux", "champagne"]);
const COUNTRY_TAGS = new Set(WINE_COUNTRIES.map((country) => plain(country)));

function ficheType(productType: string): FicheType | "" {
  return FICHE_TYPES.find((type) => plain(type) === plain(productType)) ?? "";
}

/** « 14.0 » → « 14 » ; « 13.50 » → « 13,5 » : comme on l'écrit à la main. */
function degreText(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw.trim() === "") return "";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

function isStickerChoice(value: string | null | undefined): value is StickerChoice {
  return STICKER_CHOICES.some((choice) => choice === value);
}

/**
 * Le sticker d'un vin dont la fiche n'a pas encore été choisie : ce que le site montrait jusqu'ici
 * (même règle que snippets/bp-sticker-vin.liquid) — le degré d'un spiritueux, sinon l'année, sinon le degré.
 */
export function defaultSticker(type: string, vintage: string, degre: string): StickerChoice {
  if (degre !== "" && (type === "Spiritueux" || vintage === "")) return "degre";
  if (vintage !== "") return "annee";
  return type === "Spiritueux" ? "degre" : "annee";
}

/** L'année écrite dans le nom du vin (« Peng 2022 » → « 2022 ») ; la dernière s'il y en a plusieurs ; `null` sans année. */
export function titleYear(title: string): string | null {
  const years = title.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g);
  return years === null ? null : (years[years.length - 1] ?? null);
}

/** Le texte du sticker tel que le site l'écrit : « 2023 », « Vol. 13,5 % » ; vide si l'information manque. */
export function stickerText(choice: string, values: Pick<FicheValues, "vintage" | "degre">): string {
  if (choice === "annee") return /^\d{4}$/.test(values.vintage) ? values.vintage : "";
  const degre = parseDegre(values.degre);
  return degre === null ? "" : `Vol. ${degreText(degre)}\u00A0%`;
}

/**
 * L'année et le sticker doivent dire la même chose partout : l'année du nom = la case « Année » (que lisent le sticker
 * et la fiche d'identité du site), et le sticker montre une information qui existe. Vérifié pendant la saisie et à
 * l'enregistrement. Une année encore incomplète (« 202 ») n'est pas comparée : sa forme est vérifiée à l'enregistrement.
 */
export function yearAndStickerErrors(values: Pick<FicheValues, "title" | "vintage" | "degre" | "sticker">): FicheErrors {
  const errors: FicheErrors = {};
  const named = titleYear(values.title);
  if (named !== null && named !== values.vintage && (values.vintage === "" || /^\d{4}$/.test(values.vintage))) {
    errors.vintage =
      values.vintage === ""
        ? `Le nom du vin dit ${named}\u202F: écrivez aussi ${named} ici.`
        : `Le nom du vin dit ${named}, cette case dit ${values.vintage}\u202F: mettez la même année aux deux endroits.`;
  }
  if (!isStickerChoice(values.sticker)) errors.sticker = "Choisissez ce que montre le sticker\u202F: l’année ou le degré.";
  else if (values.sticker === "annee" && values.vintage === "") errors.sticker = "Écrivez l’année dans la case « Année », ou choisissez le degré.";
  else if (values.sticker === "degre" && values.degre === "") errors.sticker = "Écrivez le degré dans la case « Degré d’alcool », ou choisissez l’année.";
  return errors;
}

/** Les valeurs du formulaire, lues dans le vin tel qu'il est dans Shopify. */
export function ficheValuesFromProduct(product: FicheProduct): FicheValues {
  const info = readWineInfo(product.productType, product.tags);
  const volume = product.metafields.volume_ml;
  const bottleMl = info.bottleMl ?? (volume !== null && volume !== undefined && /^\d+$/.test(volume) ? Number(volume) : null);
  const size = bottleMl === null ? "" : sizeTagValue(bottleMl);
  const type = ficheType(product.productType);
  const vintage = info.vintage ?? "";
  const degre = degreText(product.metafields.degre);
  const sticker = product.metafields.sticker;
  return {
    title: product.title,
    vendor: product.vendor,
    type,
    country: info.country ?? "",
    region: info.region ?? "",
    vintage,
    appellation: info.appellation ?? "",
    size: FICHE_SIZE_CHOICES.some((choice) => choice.value === size) ? size : "",
    degre,
    sticker: isStickerChoice(sticker) ? sticker : defaultSticker(type, vintage, degre),
    cepage: product.metafields.cepage ?? "",
    regionLine: product.metafields.regionLine ?? "",
    degustation: product.metafields.degustation ?? "",
    producteur: product.metafields.producteur ?? "",
    service: product.metafields.service ?? "",
    conservation: product.metafields.conservation ?? "",
  };
}

const NARROW_NBSP = "\u202F";
const NBSP = "\u00A0";

/**
 * Typographie française des textes du site, comme ceux déjà en ligne : espace fine insécable avant « ; : ! ? »
 * et dans les guillemets « », espace insécable entre un nombre et son unité. On ne remplace que des espaces
 * ordinaires déjà tapées : rien n'est ajouté (une adresse comme https://… reste intacte), et une espace déjà
 * insécable reste telle quelle (enregistrer une fiche sans la changer ne change donc pas ses textes).
 */
export function frenchSpacing(text: string): string {
  return text
    .replace(/ +([;:!?»])/g, `${NARROW_NBSP}$1`)
    .replace(/« +/g, `«${NARROW_NBSP}`)
    .replace(/(\d) +%/g, `$1${NARROW_NBSP}%`)
    .replace(/(\d) +(°C|cl|ml|kg|km|m|hectares?|ha|ans?|mois|jours?|heures?|bouteilles?|litres?)(?![\p{L}\d])/gu, `$1${NBSP}$2`);
}

/** Le degré tapé (« 14 », « 13,5 », « 13.5 % ») → « 13.5 » pour Shopify ; `null` si illisible. */
export function parseDegre(raw: string): string | null {
  const text = raw.replace(/%|vol\.?/gi, "").trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d)?$/.test(text)) return null;
  const value = Number(text);
  if (value <= 0 || value > 80) return null;
  return value.toFixed(1);
}

/** Les textes de la fiche qui s'écrivent sur plusieurs lignes (un paragraphe par ligne sur le site). */
const MULTILINE_FIELDS: ReadonlySet<FicheField> = new Set(["degustation", "producteur", "service", "conservation"]);

function text(form: FormData, field: FicheField): string {
  const value = form.get(field);
  if (typeof value !== "string") return "";
  const lines = value.replace(/\r\n?/g, "\n");
  // Les autres cases tiennent sur une ligne : un retour à la ligne collé par erreur devient une espace.
  return (MULTILINE_FIELDS.has(field) ? lines : lines.replace(/\s*\n\s*/g, " ")).trim();
}

function isFicheType(value: string): value is FicheType {
  return FICHE_TYPES.some((type) => type === value);
}

export interface MetafieldWrite {
  readonly namespace: string;
  readonly key: string;
  readonly type: string;
  readonly value: string;
}

export interface FicheInput {
  readonly title: string;
  readonly vendor: string;
  readonly productType: FicheType;
  /** Pays, région, année, appellation et contenance : les étiquettes Shopify à écrire. */
  readonly country: string | null;
  readonly region: string | null;
  readonly vintage: string | null;
  readonly appellation: string | null;
  readonly bottleMl: number;
  /** Métachamps à écrire, et ceux à effacer (cases vidées). */
  readonly metafields: readonly MetafieldWrite[];
  readonly clearedKeys: readonly string[];
  readonly values: FicheValues;
}

export type ParsedFiche =
  | { readonly ok: true; readonly input: FicheInput }
  | { readonly ok: false; readonly values: FicheValues; readonly errors: FicheErrors };

export function parseFiche(form: FormData): ParsedFiche {
  const values = Object.fromEntries(FICHE_FIELDS.map((field) => [field, text(form, field)])) as Record<FicheField, string>;
  const errors: FicheErrors = {};
  for (const field of FICHE_FIELDS) {
    if (values[field].length > MAX_LENGTH[field]) errors[field] = `C’est trop long (${MAX_LENGTH[field]} lettres au plus).`;
  }
  if (values.title.length < 2) errors.title = "Écrivez le nom du vin.";
  if (!isFicheType(values.type)) errors.type = "Choisissez la sorte.";
  const spirit = values.type === "Spiritueux";
  if (values.country !== "" && !WINE_COUNTRIES.some((country) => country === values.country)) errors.country = "Choisissez le pays dans la liste.";
  else if (values.country === "" && !spirit) errors.country = "Choisissez le pays d’où vient le vin.";
  if (values.vintage !== "") {
    const year = /^\d{4}$/.test(values.vintage) ? Number(values.vintage) : null;
    if (year === null || year < 1900 || year > 2100) errors.vintage = "L’année s’écrit avec quatre chiffres, par exemple 2024.";
  }
  const bottleMl = parseBottleSize(values.size);
  if (bottleMl === null || !FICHE_SIZE_CHOICES.some((choice) => choice.value === values.size)) errors.size = "Choisissez la contenance de la bouteille.";
  const degre = values.degre === "" ? null : parseDegre(values.degre);
  if (values.degre !== "" && degre === null) errors.degre = "Écrivez le degré en chiffres, par exemple 13,5.";
  // L'année du nom et le sticker : une case déjà en erreur (année illisible…) garde son message.
  for (const [field, message] of Object.entries(yearAndStickerErrors(values)) as [FicheField, string][]) {
    if (errors[field] === undefined) errors[field] = message;
  }
  if (Object.keys(errors).length > 0 || !isFicheType(values.type) || bottleMl === null) return { ok: false, values, errors };

  const metafields: MetafieldWrite[] = [];
  const clearedKeys: string[] = [];
  for (const field of TEXT_METAFIELDS) {
    const { key, type } = FICHE_METAFIELDS[field];
    // Les cépages et la ligne « Région » s'écrivent comme les textes, avec « 100 % » insécable.
    if (values[field] === "") clearedKeys.push(key);
    else metafields.push({ namespace: METAFIELD_NAMESPACE, key, type, value: frenchSpacing(values[field]) });
  }
  if (degre === null) clearedKeys.push(FICHE_METAFIELDS.degre.key);
  else metafields.push({ namespace: METAFIELD_NAMESPACE, key: FICHE_METAFIELDS.degre.key, type: FICHE_METAFIELDS.degre.type, value: degre });
  metafields.push({ namespace: METAFIELD_NAMESPACE, key: FICHE_METAFIELDS.sticker.key, type: FICHE_METAFIELDS.sticker.type, value: values.sticker });
  metafields.push({ namespace: METAFIELD_NAMESPACE, key: VOLUME_METAFIELD.key, type: VOLUME_METAFIELD.type, value: String(bottleMl) });

  return {
    ok: true,
    input: {
      title: values.title,
      vendor: values.vendor,
      productType: values.type,
      country: values.country === "" ? null : values.country,
      region: values.region === "" ? null : values.region,
      vintage: values.vintage === "" ? null : values.vintage,
      appellation: values.appellation === "" ? null : values.appellation,
      bottleMl,
      metafields,
      clearedKeys,
      values,
    },
  };
}

/**
 * Les étiquettes du vin après la fiche : sorte, pays (y compris l'ancienne étiquette « Italie » seule, si le vin l'avait),
 * région, année, appellation et contenance sont remplacés ; toutes les autres étiquettes (« pro », promotions…) restent.
 */
export function ficheTags(current: readonly string[], input: Pick<FicheInput, "productType" | "country" | "region" | "vintage" | "appellation" | "bottleMl">): string[] {
  const hadBareCountry = current.some((tag) => COUNTRY_TAGS.has(plain(tag)));
  const kept = current.filter((tag) => !TYPE_TAGS.has(plain(tag)) && !COUNTRY_TAGS.has(plain(tag)));
  const withInfo = withWineTags(kept, {
    country: input.country,
    region: input.region,
    vintage: input.vintage,
    appellation: input.appellation,
    bottleMl: input.bottleMl,
  });
  const extra = [plain(input.productType), ...(hadBareCountry && input.country !== null ? [input.country] : [])];
  return [...withInfo, ...extra.filter((tag) => !withInfo.includes(tag))];
}

/** Ex. « La fiche de « Peng 2022 » est enregistrée. Le site est à jour. » */
export function ficheSavedMessage(title: string): string {
  return `La fiche de « ${title} » est enregistrée. Le site est à jour.`;
}

/** Les régions du menu du site, sans doublon, dans l'ordre alphabétique : « region:Toscane » → « Toscane ». */
export function regionChoices(productTags: readonly string[]): string[] {
  const regions = new Map<string, string>();
  for (const tag of productTags) {
    const colon = tag.indexOf(":");
    if (colon < 0 || plain(tag.slice(0, colon)) !== "region") continue;
    const region = tag.slice(colon + 1).trim();
    if (region !== "" && !regions.has(plain(region))) regions.set(plain(region), region);
  }
  return [...regions.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Le nom du vin quand on change l'année : « Peng 2022 » devient « Peng 2023 ».
 * Le nom ne change que s'il contient l'ancienne année et que la nouvelle a bien quatre chiffres.
 */
export function retitle(title: string, oldVintage: string, newVintage: string): string {
  if (!/^\d{4}$/.test(oldVintage) || !/^\d{4}$/.test(newVintage)) return title;
  return title.replace(new RegExp(`(^|\\D)${oldVintage}(?!\\d)`), `$1${newVintage}`);
}
