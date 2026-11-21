import { describe, expect, it } from "vitest";
import { toShopifyClient, type CustomerMatchNode } from "./shopify-client";

const UUID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function node(overrides: Partial<CustomerMatchNode> = {}): CustomerMatchNode {
  return {
    id: "gid://shopify/Customer/7",
    displayName: "Marie Rochat",
    firstName: "Marie",
    lastName: "Rochat",
    tags: [],
    defaultEmailAddress: { emailAddress: "Marie@Lac.ch" },
    defaultPhoneNumber: { phoneNumber: "+41791112233" },
    defaultAddress: { company: "Restaurant du Lac", zip: "1095", city: "Lutry" },
    lien: null,
    refus: null,
    companyContactProfiles: [],
    ...overrides,
  };
}

describe("toShopifyClient", () => {
  it("reprend e-mail, téléphone, localité et les noms (dans les deux sens, entreprise comprise)", () => {
    expect(toShopifyClient(node())).toMatchObject({
      customerId: "gid://shopify/Customer/7",
      displayName: "Marie Rochat",
      names: ["Marie Rochat", "Rochat Marie", "Restaurant du Lac"],
      email: "marie@lac.ch",
      phone: "+41791112233",
      town: "1095 Lutry",
      hasAddress: true,
      isPro: false,
      companyIds: [],
      link: null,
      companyLink: null,
      refused: [],
    });
  });

  it("lit l'entreprise, son lien et l'étiquette pro", () => {
    const client = toShopifyClient(
      node({
        tags: ["Pro"],
        lien: { value: JSON.stringify({ uuid: UUID, kind: "company", number: "A1" }) },
        refus: { value: JSON.stringify([OTHER]) },
        companyContactProfiles: [
          {
            roleAssignments: { nodes: [{ id: "gid://shopify/CompanyContactRoleAssignment/1" }] },
            company: { id: "gid://shopify/Company/3", name: "Lac SA", lien: { value: JSON.stringify({ uuid: UUID, kind: "company", number: null }) } },
          },
        ],
      }),
    );
    expect(client).toMatchObject({
      isPro: true,
      proReady: true,
      linkedCompanyId: "gid://shopify/Company/3",
      companyIds: ["gid://shopify/Company/3"],
      link: { uuid: UUID, number: "A1" },
      companyLink: { uuid: UUID, number: null },
      refused: [OTHER],
    });
    expect(client.names).toContain("Lac SA");
  });

  it("voit un compte pro inachevé : sans étiquette pro, ou sans rôle sur l'établissement", () => {
    const profile = (roles: number) => ({
      roleAssignments: { nodes: Array.from({ length: roles }, (_, index) => ({ id: `gid://shopify/CompanyContactRoleAssignment/${index}` })) },
      company: { id: "gid://shopify/Company/3", name: "Lac SA", lien: null },
    });
    expect(toShopifyClient(node({ tags: [], companyContactProfiles: [profile(1)] })).proReady).toBe(false);
    expect(toShopifyClient(node({ tags: ["pro"], companyContactProfiles: [profile(0)] })).proReady).toBe(false);
    expect(toShopifyClient(node({ tags: ["pro"], companyContactProfiles: [profile(1)] })).proReady).toBe(true);
    expect(toShopifyClient(node({ tags: ["pro"] })).proReady).toBe(true);
  });

  it("supporte un client sans adresse, sans e-mail ni téléphone", () => {
    const client = toShopifyClient(node({ defaultAddress: null, defaultEmailAddress: null, defaultPhoneNumber: null, firstName: null, lastName: null }));
    expect(client).toMatchObject({ email: null, phone: null, town: null, hasAddress: false, names: ["Marie Rochat"] });
  });
});
