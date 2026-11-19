import { describe, expect, it, vi } from "vitest";

vi.mock("./repository.server", () => ({}));
vi.mock("./links.server", () => ({}));
vi.mock("./email.server", () => ({}));
vi.mock("../reglages/settings.server", () => ({}));
vi.mock("../shopify/graphql.server", () => ({}));
vi.mock("../core/logger.server", () => ({}));

const { invoiceFileName } = await import("./send.server");

describe("invoiceFileName", () => {
  it("nomme « Facture » une facture à payer et « Recu » une facture déjà payée, pro ou non", () => {
    expect(invoiceFileName({ number: "BP-2026-0042", paidOn: null })).toBe("Facture-BP-2026-0042.pdf");
    expect(invoiceFileName({ number: "BP-2026-0043", paidOn: "2026-11-10" })).toBe("Recu-BP-2026-0043.pdf");
  });
});
