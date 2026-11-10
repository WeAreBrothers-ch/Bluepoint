import { describe, expect, it } from "vitest";
import { createAddressResponseSchema, createInvoiceResponseSchema, envelope } from "./schemas";
import { z } from "zod";

describe("schemas", () => {
  it("l'enveloppe exige `data` et tolère le reste", () => {
    const schema = envelope(z.string());
    expect(schema.safeParse({ data: "x", extra: 1, meta: null }).success).toBe(true);
    expect(schema.safeParse({ message: "ok" }).success).toBe(false);
  });

  it("création : distingue 201 et 202", () => {
    const uuid = "44444444-4444-4444-8444-444444444444";
    expect(createInvoiceResponseSchema.parse({ data: { documents: [{ uuid }] } }).kind).toBe("created");
    expect(createInvoiceResponseSchema.parse({ data: { queueUuid: uuid } }).kind).toBe("queued");
    expect(createInvoiceResponseSchema.safeParse({ data: {} }).success).toBe(false);
  });

  it("adresse : refuse un uuid invalide", () => {
    expect(createAddressResponseSchema.safeParse({ data: { uuid: "123" } }).success).toBe(false);
  });
});
