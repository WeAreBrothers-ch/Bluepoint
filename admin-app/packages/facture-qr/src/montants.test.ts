import { describe, expect, it } from "vitest";
import { ajouterJours, dateLocaleSuisse, formaterDate, lireDateIso } from "./dates";
import { FactureError } from "./erreurs";
import { centimesDepuisTexte, formaterCHF, formaterMontant, formaterTaux } from "./montants";
import { libelleValeur, typographier } from "./typographie";

describe("formaterMontant", () => {
  it("sépare les milliers par une apostrophe typographique et garde deux décimales", () => {
    expect(formaterCHF(144000)).toBe("CHF\u00a01\u2019440.00");
    expect(formaterMontant(100000000)).toBe("1\u2019000\u2019000.00");
    expect(formaterMontant(5)).toBe("0.05");
    expect(formaterMontant(2450)).toBe("24.50");
  });

  it("écrit les montants négatifs avec un vrai signe moins", () => {
    expect(formaterMontant(-5000)).toBe("\u221250.00");
  });

  it("refuse un montant qui n'est pas en centimes entiers", () => {
    expect(() => formaterMontant(12.5)).toThrow(RangeError);
  });
});

describe("centimesDepuisTexte", () => {
  it("lit les montants Shopify sans erreur d'arrondi", () => {
    expect(centimesDepuisTexte("24.0")).toBe(2400);
    expect(centimesDepuisTexte("1551.00")).toBe(155100);
    expect(centimesDepuisTexte("0.1")).toBe(10);
    expect(centimesDepuisTexte("116.22")).toBe(11622);
    expect(centimesDepuisTexte("-3.5")).toBe(-350);
  });

  it("refuse les fractions de centime et les textes illisibles", () => {
    expect(centimesDepuisTexte("1.005")).toBeNull();
    expect(centimesDepuisTexte("abc")).toBeNull();
  });
});

describe("typographie", () => {
  it("met une espace fine insécable avant ; : ! ? sans toucher aux heures ni aux URL", () => {
    expect(typographier("Attention: livraison ! Merci?")).toBe("Attention\u202f: livraison\u202f! Merci\u202f?");
    expect(typographier("Livré à 13:39 via https://bluepoint.ch")).toBe("Livré à 13:39 via https://bluepoint.ch");
  });

  it("remplace l'apostrophe droite et protège les guillemets", () => {
    expect(typographier("L'Esprit du « vin »")).toBe("L\u2019Esprit du «\u00a0vin\u00a0»");
  });

  it("écrit un taux de TVA et une mention au format suisse", () => {
    expect(formaterTaux(8.1)).toBe("8,1\u202f%");
    expect(libelleValeur("Échéance", "20.11.2026")).toBe("Échéance\u202f:\u00a020.11.2026");
  });
});

describe("dates", () => {
  it("écrit les dates au format suisse JJ.MM.AAAA", () => {
    expect(formaterDate("2026-10-21")).toBe("21.10.2026");
    expect(ajouterJours("2026-12-15", 30)).toBe("2027-01-14");
  });

  it("refuse les dates impossibles", () => {
    expect(() => lireDateIso("2026-02-31")).toThrow(FactureError);
    expect(() => lireDateIso("21.10.2026")).toThrow(FactureError);
  });

  it("prend la date de Suisse d'une commande passée tard le soir", () => {
    expect(dateLocaleSuisse("2026-10-14T22:30:00Z")).toBe("2026-10-15");
    expect(dateLocaleSuisse("2026-10-14T21:47:12Z")).toBe("2026-10-14");
  });
});
