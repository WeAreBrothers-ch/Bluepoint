import { describe, expect, it } from "vitest";
import { filterProducts, toProductOption } from "./catalog";
import { customerSearchQuery, toCustomerOption, toLastOrder } from "./customers";
import { customerNode, product, variantNode, VARIANT_B } from "./fixtures";

describe("customerSearchQuery", () => {
  it("garde une recherche plein texte et retire la syntaxe de filtre", () => {
    expect(customerSearchQuery("  La Poésia ")).toBe("La Poésia");
    expect(customerSearchQuery('tag:"vip" OR (x)')).toBe("tag vip OR x");
    expect(customerSearchQuery("a")).toBeNull();
  });
});

describe("toCustomerOption", () => {
  it("lit l'adresse et le téléphone par défaut", () => {
    const option = toCustomerOption(customerNode());
    expect(option?.phone).toBe("+41211234567");
    expect(option?.address?.countryCode).toBe("CH");
    expect(option?.addressLines).toContain("1095 Lutry VD");
    expect(option?.b2b).toEqual([]);
  });

  it("supporte une boutique sans B2B (profils absents)", () => {
    const node = customerNode({ companyContactProfiles: undefined, defaultPhoneNumber: null, defaultAddress: null });
    const option = toCustomerOption(node);
    expect(option?.b2b).toEqual([]);
    expect(option?.phone).toBeNull();
    expect(option?.addressLines).toEqual([]);
  });

  it("liste chaque site d'entreprise une seule fois", () => {
    const location = { companyLocation: { id: "gid://shopify/CompanyLocation/3", name: "Lutry" } };
    const option = toCustomerOption(
      customerNode({
        companyContactProfiles: [
          { id: "gid://shopify/CompanyContact/2", company: { id: "gid://shopify/Company/1", name: "La Poésia SA" }, roleAssignments: { nodes: [location, location] } },
        ],
      }),
    );
    expect(option?.b2b).toEqual([
      {
        companyId: "gid://shopify/Company/1",
        companyContactId: "gid://shopify/CompanyContact/2",
        companyLocationId: "gid://shopify/CompanyLocation/3",
        companyName: "La Poésia SA",
        locationName: "Lutry",
      },
    ]);
  });

  it("écarte un identifiant illisible", () => {
    expect(toCustomerOption(customerNode({ id: "gid://shopify/Order/1" }))).toBeNull();
  });
});

describe("catalogue", () => {
  it("lit prix, stock suivi et vignette", () => {
    expect(toProductOption(variantNode())).toMatchObject({ priceCents: 1850, available: 24, variantTitle: null, imageAlt: "Chasselas de Lavaux" });
  });

  it("stock non suivi = null, variante nommée gardée", () => {
    const node = variantNode({
      title: "Magnum",
      inventoryItem: { tracked: false },
      product: { ...variantNode().product, hasOnlyDefaultVariant: false, featuredMedia: null },
    });
    expect(toProductOption(node)).toMatchObject({ available: null, variantTitle: "Magnum", imageUrl: null });
  });

  it("filtre sans tenir compte des accents ni de la casse", () => {
    const products = [product(), product({ variantId: VARIANT_B, productTitle: "Rosé de Gamay", sku: "ROS-1" })];
    expect(filterProducts(products, "rose").map((p) => p.productTitle)).toEqual(["Rosé de Gamay"]);
    expect(filterProducts(products, "cha 75")).toHaveLength(1);
    expect(filterProducts(products, " ")).toHaveLength(2);
  });
});

describe("toLastOrder", () => {
  it("garde les vins encore commandés, au jour suisse de la commande", () => {
    const last = toLastOrder({
      name: "#1002",
      createdAt: "2026-10-27T23:30:00Z",
      lineItems: {
        nodes: [
          { currentQuantity: 2, variant: { id: "gid://shopify/ProductVariant/1" } },
          { currentQuantity: 0, variant: { id: "gid://shopify/ProductVariant/2" } },
          { currentQuantity: 3, variant: null },
        ],
      },
    });
    expect(last).toEqual({ name: "#1002", date: "2026-10-28", lines: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 2 }] });
  });

  it("ignore une commande sans vin à reprendre", () => {
    expect(toLastOrder(null)).toBeNull();
    expect(toLastOrder({ name: "#1", createdAt: "2026-10-27T10:00:00Z", lineItems: { nodes: [] } })).toBeNull();
  });

  it("reconnaît un client pro par son étiquette ou son entreprise", () => {
    expect(toCustomerOption(customerNode({ tags: [" Pro "] }))?.isPro).toBe(true);
    expect(toCustomerOption(customerNode())?.isPro).toBe(false);
  });
});
