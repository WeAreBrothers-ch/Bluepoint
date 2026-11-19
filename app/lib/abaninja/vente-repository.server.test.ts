import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Base simulée en mémoire : unicité (P2002) et UPDATE conditionnels, comme PostgreSQL. */
type Row = Record<string, unknown> & { orderId: string; reference: string };

const rows = new Map<string, Row>();

function uniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("doublon", { code: "P2002", clientVersion: "test" });
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

const fakePrisma = vi.hoisted(() => ({ abaNinjaSale: {} as Record<string, ReturnType<typeof vi.fn>> }));

vi.mock("../../db.server", () => ({ default: fakePrisma }));

const repo = await import("./vente-repository.server");

const CLAIM = { shop: "test.myshopify.com", orderId: "gid://shopify/Order/1042", orderName: "#1042", reference: "BP-ESSAI-CMD-1042-20261119-110530", isTest: true };

beforeEach(() => {
  rows.clear();
  Object.assign(fakePrisma.abaNinjaSale, {
    create: vi.fn(async ({ data }: { data: Row }) => {
      if ([...rows.values()].some((row) => row.orderId === data.orderId || row.reference === data.reference)) throw uniqueError();
      const row = { noteState: "en_cours", invoiceState: null, ...data };
      rows.set(data.orderId, row);
      return { ...row };
    }),
    findUnique: vi.fn(async ({ where }: { where: { orderId: string } }) => {
      const row = rows.get(where.orderId);
      return row === undefined ? null : { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = [...rows.values()].find((candidate) => matches(candidate, where));
      if (row === undefined) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const row = [...rows.values()].find((candidate) => matches(candidate, where));
      if (row !== undefined) rows.delete(row.orderId);
      return { count: row === undefined ? 0 : 1 };
    }),
    findMany: vi.fn(async () => [...rows.values()]),
  });
});

describe("une commande, une seule ligne de vente AbaNinja", () => {
  it("la première réservation prend la ligne ; la deuxième la retrouve sans la prendre", async () => {
    const first = await repo.claimSale(CLAIM);
    const second = await repo.claimSale(CLAIM);
    expect(first).toMatchObject({ ok: true, value: { claimed: true, sale: { orderId: CLAIM.orderId, noteState: "en_cours" } } });
    expect(second).toMatchObject({ ok: true, value: { claimed: false, sale: { orderId: CLAIM.orderId } } });
    expect(rows.size).toBe(1);
  });

  it("un bon refusé peut être libéré pour réessayer ; un bon fait ne l'est jamais", async () => {
    await repo.claimSale(CLAIM);
    await repo.markNote(CLAIM.orderId, { state: "cree", noteUuid: "n", noteNumber: "L00042", addressUuid: "a", companyUuid: "c" });
    await repo.releaseRefusedSale(CLAIM.orderId);
    expect(rows.size).toBe(1);
    await repo.markNote(CLAIM.orderId, { state: "refuse", errorCode: "bon" });
    await repo.releaseRefusedSale(CLAIM.orderId);
    expect(rows.size).toBe(0);
  });

  it("la facture ne se réserve qu'une fois, et seulement sur un bon fait", async () => {
    await repo.claimSale(CLAIM);
    expect(await repo.claimConversion(CLAIM.orderId)).toEqual({ ok: true, value: false });
    await repo.markNote(CLAIM.orderId, { state: "cree", noteUuid: "n", noteNumber: null, addressUuid: "a", companyUuid: "c" });
    expect(fakePrisma.abaNinjaSale["updateMany"]).toHaveBeenLastCalledWith(expect.objectContaining({ where: { orderId: CLAIM.orderId } }));
    expect(await repo.claimConversion(CLAIM.orderId)).toEqual({ ok: true, value: true });
    expect(fakePrisma.abaNinjaSale["updateMany"]).toHaveBeenLastCalledWith({
      where: { orderId: CLAIM.orderId, noteState: "cree", invoiceState: null },
      data: { invoiceState: "en_cours" },
    });
    expect(await repo.claimConversion(CLAIM.orderId)).toEqual({ ok: true, value: false });
  });

  it("une facture refusée (rien créé) libère la réservation pour réessayer", async () => {
    await repo.claimSale(CLAIM);
    await repo.markNote(CLAIM.orderId, { state: "cree", noteUuid: "n", noteNumber: null, addressUuid: "a", companyUuid: "c" });
    await repo.claimConversion(CLAIM.orderId);
    const refused = await repo.markInvoice(CLAIM.orderId, { state: "refusee", errorCode: "x" });
    expect(refused).toMatchObject({ ok: true, value: { invoiceState: null, lastErrorCode: "x" } });
    expect(await repo.claimConversion(CLAIM.orderId)).toEqual({ ok: true, value: true });
  });

  it("une panne de la base devient une erreur, jamais une exception", async () => {
    fakePrisma.abaNinjaSale["findUnique"]?.mockRejectedValueOnce(new Error("base injoignable"));
    expect(await repo.findSale(CLAIM.orderId)).toMatchObject({ ok: false });
  });
});
