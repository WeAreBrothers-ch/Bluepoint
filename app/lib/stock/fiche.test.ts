import { describe, expect, it } from "vitest";
import {
  defaultSticker,
  ficheSavedMessage,
  ficheTags,
  ficheValuesFromProduct,
  frenchSpacing,
  parseDegre,
  parseFiche,
  regionChoices,
  retitle,
  stickerText,
  titleYear,
  yearAndStickerErrors,
  type FicheValues,
} from "./fiche";

const PENG = {
  title: "Peng 2022",
  vendor: "Ca Modeano",
  productType: "Rouge",
  tags: ["Italie", "contenance:75", "millesime:2022", "pays:Italie", "region:Frioul", "rouge"],
  metafields: {
    regionLine: "Venezia Giulia IGT, Frioul",
    cepage: "Refosco dal Peduncolo Rosso, Merlot",
    degre: "14.0",
    degustation: "Ligne 1\nLigne 2",
    producteur: "Ca Modeano tient son nom de Modeano.",
    service: "Entre 16 et 18\u00A0°C.",
    conservation: null,
    volume_ml: "750",
  },
} as const;

function form(values: Partial<FicheValues>): FormData {
  const data = new FormData();
  const base = ficheValuesFromProduct(PENG);
  for (const [key, value] of Object.entries({ ...base, ...values })) data.set(key, value);
  return data;
}

describe("fiche d'un vin : lecture", () => {
  it("remplit le formulaire avec ce que le vin a déjà", () => {
    expect(ficheValuesFromProduct(PENG)).toEqual({
      title: "Peng 2022",
      vendor: "Ca Modeano",
      type: "Rouge",
      country: "Italie",
      region: "Frioul",
      vintage: "2022",
      appellation: "",
      size: "75",
      degre: "14",
      sticker: "annee",
      cepage: "Refosco dal Peduncolo Rosso, Merlot",
      regionLine: "Venezia Giulia IGT, Frioul",
      degustation: "Ligne 1\nLigne 2",
      producteur: "Ca Modeano tient son nom de Modeano.",
      service: "Entre 16 et 18\u00A0°C.",
      conservation: "",
    });
  });

  it("lit la contenance dans le métachamp si l'étiquette manque, et une sorte écrite autrement", () => {
    const values = ficheValuesFromProduct({ ...PENG, productType: "rosé", tags: ["pays:Suisse"], metafields: { volume_ml: "700", degre: "13.5" } });
    expect(values).toMatchObject({ type: "Rosé", size: "70", vintage: "", degre: "13,5", cepage: "" });
  });
});

describe("fiche d'un vin : vérification", () => {
  it("accepte une fiche complète et prépare les métachamps", () => {
    const parsed = parseFiche(form({ vintage: "2023", title: "Peng 2023", degre: "13,5", conservation: "Se garde 10 ans." }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input).toMatchObject({ title: "Peng 2023", productType: "Rouge", country: "Italie", vintage: "2023", bottleMl: 750 });
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "degre", type: "number_decimal", value: "13.5" });
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "volume_ml", type: "number_integer", value: "750" });
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "conservation", type: "multi_line_text_field", value: "Se garde 10\u00A0ans." });
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "sticker", type: "single_line_text_field", value: "annee" });
    expect(parsed.input.clearedKeys).toEqual([]);
  });

  it("efface les cases vidées", () => {
    const parsed = parseFiche(form({ service: "", degre: "" }));
    expect(parsed.ok && parsed.input.clearedKeys).toEqual(["service", "conservation", "degre"]);
  });

  it("refuse une année, un degré, une sorte ou une contenance illisibles", () => {
    const parsed = parseFiche(form({ vintage: "25", degre: "beaucoup", type: "Bière", size: "33" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["degre", "size", "type", "vintage"]);
  });

  it("demande le pays d'un vin, mais pas celui d'un spiritueux", () => {
    expect(parseFiche(form({ country: "" })).ok).toBe(false);
    expect(parseFiche(form({ country: "", type: "Spiritueux" })).ok).toBe(true);
  });

  it("met sur une ligne les cases d'une ligne, garde les paragraphes des textes", () => {
    const parsed = parseFiche(form({ cepage: "Merlot,\r\n  Cabernet", degustation: "Nez fruité.\r\nBouche ronde." }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "cepage", type: "single_line_text_field", value: "Merlot, Cabernet" });
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "degustation", type: "multi_line_text_field", value: "Nez fruité.\nBouche ronde." });
  });

  it("refuse un nom vide ou un texte trop long", () => {
    const parsed = parseFiche(form({ title: " ", degustation: "x".repeat(3001) }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.title).toBe("Écrivez le nom du vin.");
    expect(parsed.errors.degustation).toBe("C’est trop long (3000 lettres au plus).");
  });
});

describe("fiche d'un vin : étiquettes", () => {
  it("remplace la sorte, le pays, la région, l'année et la contenance, garde les autres étiquettes", () => {
    const tags = ficheTags([...PENG.tags, "pro-promo"], {
      productType: "Blanc",
      country: "Suisse",
      region: "Vaud",
      vintage: "2025",
      appellation: "Yvorne Grand Cru",
      bottleMl: 700,
    });
    expect([...tags].sort()).toEqual(["Suisse", "appellation:Yvorne Grand Cru", "blanc", "contenance:70", "millesime:2025", "pays:Suisse", "pro-promo", "region:Vaud"].sort());
  });

  it("n'ajoute pas l'étiquette du pays seule si le vin ne l'avait pas, et retire l'année effacée", () => {
    const tags = ficheTags(["pays:Italie", "millesime:2020", "rose"], { productType: "Rosé", country: "Italie", region: null, vintage: null, appellation: null, bottleMl: 750 });
    expect([...tags].sort()).toEqual(["contenance:75", "pays:Italie", "rose"]);
  });
});

describe("fiche d'un vin : typographie", () => {
  it("met les espaces insécables comme dans les textes du site", () => {
    expect(frenchSpacing("À table : du poisson ; « bon » ! 100 % Merlot, 18 mois, 10 °C, 0,5 hectare")).toBe(
      "À table\u202F: du poisson\u202F; «\u202Fbon\u202F»\u202F! 100\u202F% Merlot, 18\u00A0mois, 10\u00A0°C, 0,5\u00A0hectare",
    );
  });

  it("laisse les espaces déjà insécables comme elles sont", () => {
    const typed = "Entre 6 et 8\u202F°C\u202F; 100\u00A0% Merlot\u00A0: 18\u202Fmois.";
    expect(frenchSpacing(typed)).toBe(typed);
  });

  it("ne touche pas aux adresses ni aux mots qui commencent par une unité", () => {
    expect(frenchSpacing("https://exemple.ch")).toBe("https://exemple.ch");
    expect(frenchSpacing("en 2023 merveilleux")).toBe("en 2023 merveilleux");
  });

  it("lit le degré", () => {
    expect(parseDegre("14")).toBe("14.0");
    expect(parseDegre("13,5 %")).toBe("13.5");
    expect(parseDegre("0")).toBeNull();
    expect(parseDegre("13,55")).toBeNull();
  });

  it("annonce l'enregistrement", () => {
    expect(ficheSavedMessage("Peng 2022")).toBe("La fiche de « Peng 2022 » est enregistrée. Le site est à jour.");
  });
});

describe("fiche d'un vin : régions et année du nom", () => {
  it("liste les régions du menu du site, sans doublon et dans l'ordre", () => {
    expect(regionChoices(["region:Toscane", "rouge", "region:Piémont", "Region: toscane", "pays:Italie", "region:", "region:Émilie-Romagne"])).toEqual([
      "Émilie-Romagne",
      "Piémont",
      "Toscane",
    ]);
  });

  it("change l'année dans le nom du vin", () => {
    expect(retitle("Peng 2022", "2022", "2023")).toBe("Peng 2023");
    expect(retitle("2019 Ostinatamente", "2019", "2020")).toBe("2020 Ostinatamente");
    expect(retitle("Cuvée 12022", "2022", "2023")).toBe("Cuvée 12022");
    expect(retitle("Peng", "2022", "2023")).toBe("Peng");
    expect(retitle("Peng 2022", "2022", "202")).toBe("Peng 2022");
    expect(retitle("Peng", "", "2023")).toBe("Peng");
  });
});

describe("fiche d'un vin : sticker de la photo", () => {
  it("garde le choix enregistré, sinon reprend ce que le site montrait", () => {
    expect(ficheValuesFromProduct({ ...PENG, metafields: { ...PENG.metafields, sticker: "degre" } }).sticker).toBe("degre");
    expect(ficheValuesFromProduct({ ...PENG, metafields: { ...PENG.metafields, sticker: "autre" } }).sticker).toBe("annee");
    expect(defaultSticker("Rouge", "2022", "14")).toBe("annee");
    expect(defaultSticker("Rouge", "", "14")).toBe("degre");
    expect(defaultSticker("Spiritueux", "2022", "43")).toBe("degre");
    expect(defaultSticker("Blanc", "", "")).toBe("annee");
  });

  it("enregistre le degré comme sticker, même pour un vin qui a une année", () => {
    const parsed = parseFiche(form({ sticker: "degre", degre: "13,5" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.metafields).toContainEqual({ namespace: "bluepoint", key: "sticker", type: "single_line_text_field", value: "degre" });
  });

  it("refuse un sticker sans l'information qu'il doit montrer", () => {
    const sansDegre = parseFiche(form({ sticker: "degre", degre: "" }));
    expect(!sansDegre.ok && sansDegre.errors.sticker).toBe("Écrivez le degré dans la case « Degré d’alcool », ou choisissez l’année.");
    const sansAnnee = parseFiche(form({ sticker: "annee", vintage: "", title: "Peng" }));
    expect(!sansAnnee.ok && sansAnnee.errors.sticker).toBe("Écrivez l’année dans la case « Année », ou choisissez le degré.");
    const inconnu = parseFiche(form({ sticker: "prix" }));
    expect(!inconnu.ok && Object.keys(inconnu.errors)).toEqual(["sticker"]);
  });

  it("écrit le sticker comme le site", () => {
    expect(stickerText("annee", { vintage: "2023", degre: "13,5" })).toBe("2023");
    expect(stickerText("degre", { vintage: "2023", degre: "13,5" })).toBe("Vol. 13,5\u00A0%");
    expect(stickerText("degre", { vintage: "2023", degre: "14" })).toBe("Vol. 14\u00A0%");
    expect(stickerText("degre", { vintage: "2023", degre: "" })).toBe("");
    expect(stickerText("annee", { vintage: "202", degre: "14" })).toBe("");
  });
});

describe("fiche d'un vin : l'année du nom et la case « Année »", () => {
  it("lit l'année écrite dans le nom", () => {
    expect(titleYear("Peng 2022")).toBe("2022");
    expect(titleYear("Merlot del Ticino Picaia 2022 Bio Suisse")).toBe("2022");
    expect(titleYear("57022 Bolgheri 2024")).toBe("2024");
    expect(titleYear("Cuvée 12022")).toBeNull();
    expect(titleYear("Brunello di Montalcino")).toBeNull();
  });

  it("refuse un nom et une année qui ne disent pas la même chose", () => {
    const parsed = parseFiche(form({ title: "Le Trésor de la Tour 2025", vintage: "2023" }));
    expect(!parsed.ok && parsed.errors.vintage).toBe("Le nom du vin dit 2025, cette case dit 2023\u202F: mettez la même année aux deux endroits.");
    const vide = parseFiche(form({ title: "Il Pino di Biserno 2023", vintage: "", sticker: "degre" }));
    expect(!vide.ok && vide.errors.vintage).toBe("Le nom du vin dit 2023\u202F: écrivez aussi 2023 ici.");
  });

  it("accepte un nom sans année, et ne compare pas une année en cours de saisie", () => {
    expect(parseFiche(form({ title: "Peng", vintage: "2022" })).ok).toBe(true);
    expect(yearAndStickerErrors({ title: "Peng 2022", vintage: "202", degre: "14", sticker: "annee" })).toEqual({});
  });

  it("garde le message d'une année mal écrite plutôt que celui du nom", () => {
    const parsed = parseFiche(form({ title: "Peng 2022", vintage: "1850" }));
    expect(!parsed.ok && parsed.errors.vintage).toBe("L’année s’écrit avec quatre chiffres, par exemple 2024.");
  });
});
