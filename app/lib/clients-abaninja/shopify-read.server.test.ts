import { describe, expect, it, vi } from "vitest";
import { success } from "../core/result";

/** La boutique simulée : une page de clients, puis une page d'entreprises dont une seule porte un lien AbaNinja. */

const UUID = "11111111-1111-4111-8111-111111111111";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../shopify/graphql.server", () => ({
  runAdminGraphql: vi.fn(async (_admin: unknown, query: string) =>
    query.includes("EntreprisesPourAbaNinja")
      ? success({
          companies: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              { id: "gid://shopify/Company/8", lien: { value: JSON.stringify({ uuid: UUID, kind: "company", number: "A1" }) } },
              { id: "gid://shopify/Company/9", lien: null },
            ],
          },
        })
      : success({
          shop: { id: "gid://shopify/Shop/1", ignores: null },
          customers: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
        }),
  ),
}));

const { loadShopifySide } = await import("./shopify-read.server");

describe("loadShopifySide", () => {
  it("lit aussi les entreprises qui portent un lien, même sans client rattaché", async () => {
    const result = await loadShopifySide({} as Parameters<typeof loadShopifySide>[0]);
    expect(result.ok && result.value.linkedCompanies).toEqual([
      { companyId: "gid://shopify/Company/8", link: { uuid: UUID, kind: "company", number: "A1" } },
    ]);
  });
});
