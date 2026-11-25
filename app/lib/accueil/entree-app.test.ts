import { describe, expect, it } from "vitest";
import { adminPageUrl, ENTRY_PAGES, entryLinks, framedPageUrl, hostParam, shopEntry } from "./entree-app";

const SHOP = "5s71g8-0v.myshopify.com";
const API_KEY = "430b346e661168946e36037c5e4f9293";

/** Même contrôle que la librairie Shopify (`sanitizeHost`) : base64 seul, avec 0 à 2 « = ». */
const BASE64 = /^[0-9a-zA-Z+/]+={0,2}$/;

describe("shopEntry", () => {
  it("garde une boutique myshopify et son nom", () => {
    expect(shopEntry(SHOP)).toEqual({ shop: SHOP, handle: "5s71g8-0v" });
  });

  it("refuse tout le reste", () => {
    expect(shopEntry(null)).toBeNull();
    expect(shopEntry("")).toBeNull();
    expect(shopEntry("bluepointdistribution.com")).toBeNull();
    expect(shopEntry("evil.com/5s71g8-0v.myshopify.com")).toBeNull();
    expect(shopEntry("5s71g8-0v.myshopify.com.evil.com")).toBeNull();
  });
});

describe("adresses pour rentrer dans l'app", () => {
  const entry = shopEntry(SHOP);
  if (entry === null) throw new Error("boutique de test refusée");

  it("donne le paramètre host que Shopify donne à l'app", () => {
    const host = hostParam(entry);
    expect(host).toMatch(BASE64);
    expect(host).not.toContain("=");
    expect(atob(host)).toBe("admin.shopify.com/store/5s71g8-0v");
  });

  it("ouvre la page dans l'admin Shopify hors du cadre", () => {
    expect(adminPageUrl(entry, API_KEY, "/app/commande")).toBe(`https://admin.shopify.com/store/5s71g8-0v/apps/${API_KEY}/app/commande`);
  });

  it("recharge la page dans le cadre avec embedded, shop et host", () => {
    const url = new URL(framedPageUrl(entry, "/app/factures"), "https://bluepoint-gestion.vercel.app");
    expect(url.pathname).toBe("/app/factures");
    expect(url.searchParams.get("embedded")).toBe("1");
    expect(url.searchParams.get("shop")).toBe(SHOP);
    expect(url.searchParams.get("host")).toBe(hostParam(entry));
    expect(url.searchParams.has("id_token")).toBe(false);
  });

  it("propose les pages du menu, Livraisons en premier", () => {
    const links = entryLinks(entry, API_KEY);
    expect(links.map((link) => link.path)).toEqual(["/app", "/app/commande", "/app/factures", "/app/stock", "/app/clients"]);
    expect(links.map((link) => link.label)).toEqual(ENTRY_PAGES.map((page) => page.label));
    expect(links[0]?.label).toBe("Livraisons");
  });
});
