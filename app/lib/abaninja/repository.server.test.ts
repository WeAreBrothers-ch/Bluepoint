import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "../core/result";

/** Base simulée en mémoire : reproduit l'unicité (P2002) et les UPDATE conditionnels. */
interface Row {
  [key: string]: unknown;
  orderId: string;
  reference: string;
  state: string;
  attempts: number;
}

const rows = new Map<string, Row>();

function uniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("doublon", { code: "P2002", clientVersion: "test" });
}

function applyData(row: Row, data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    const increment = (value as { increment?: number } | null)?.increment;
    row[key] = typeof increment === "number" ? Number(row[key]) + increment : value;
  }
}

const fakePrisma = {
  abaNinjaInvoice: {
    create: vi.fn(async ({ data }: { data: Row }) => {
      const clash = [...rows.values()].some((r) => r.orderId === data.orderId || r.reference === data.reference);
      if (clash) throw uniqueError();
      rows.set(data.orderId, { ...data });
      return { ...data };
    }),
    findUnique: vi.fn(async ({ where }: { where: { orderId: string } }) => {
      const row = rows.get(where.orderId);
      return row ? { ...row } : null;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: { orderId: string; state?: string }; data: Record<string, unknown> }) => {
      const row = rows.get(where.orderId);
      if (!row || (where.state !== undefined && row.state !== where.state)) return { count: 0 };
      applyData(row, data);
      return { count: 1 };
    }),
  },
};

vi.mock("../../db.server", () => ({ default: fakePrisma }));

const repo = await import("./repository.server");

const input = { shop: "s.myshopify.com", orderId: "o1", orderName: "#1042", reference: "BP-#1042", isTest: true };

function unwrap<T>(result: Result<T, Error>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

beforeEach(() => {
  rows.clear();
});

describe("claimInvoiceSlot", () => {
  it("un seul gagnant quand deux demandes arrivent en même temps", async () => {
    const [a, b] = await Promise.all([repo.claimInvoiceSlot(input), repo.claimInvoiceSlot(input)]);
    const outcomes = [unwrap(a), unwrap(b)];
    expect(outcomes.filter((o) => o.claimed)).toHaveLength(1);
    expect(rows.size).toBe(1);
    expect(outcomes.every((o) => o.invoice.attempts === 1)).toBe(true);
  });

  it("renvoie la ligne existante sans la modifier", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    await repo.markUncertain("o1", "timeout");
    const second = unwrap(await repo.claimInvoiceSlot(input));
    expect(second.claimed).toBe(false);
    expect(second.invoice.state).toBe("incertaine");
  });

  it("échoue si la référence appartient à une autre commande", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    const result = await repo.claimInvoiceSlot({ ...input, orderId: "o2" });
    expect(result.ok).toBe(false);
  });
});

describe("transitions", () => {
  it("refuse de confirmer ou refuser une facture déjà tranchée", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    unwrap(await repo.markCreated("o1", { invoiceUuid: "u", systemInvoiceNumber: "N1" }));
    expect((await repo.markRefused("o1", "x")).ok).toBe(false);
    expect((await repo.markUncertain("o1", "x")).ok).toBe(false);
    expect((await repo.markCreated("o1", { invoiceUuid: "v", systemInvoiceNumber: "N2" })).ok).toBe(false);
    expect(rows.get("o1")?.invoiceUuid).toBe("u");
  });

  it("refuse une transition sur une commande inconnue", async () => {
    expect((await repo.markCreated("inconnue", { invoiceUuid: "u", systemInvoiceNumber: "N" })).ok).toBe(false);
  });

  it("recordStatus n'est permis que pour une facture confirmée", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    expect((await repo.recordStatus("o1", { status: "payee", openAmountCents: 0 })).ok).toBe(false);
    unwrap(await repo.markCreated("o1", { invoiceUuid: "u", systemInvoiceNumber: "N1" }));
    const done = unwrap(await repo.recordStatus("o1", { status: "payee", openAmountCents: 0 }));
    expect(done.status).toBe("payee");
    expect(done.statusCheckedAt).toBeInstanceOf(Date);
  });
});

describe("resolveUncertain", () => {
  it("confirme la facture trouvée dans AbaNinja", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    await repo.markUncertain("o1", "timeout");
    const done = unwrap(await repo.resolveUncertain("o1", { invoiceUuid: "u", systemInvoiceNumber: "N1" }));
    expect(done).toMatchObject({ state: "creee", invoiceUuid: "u" });
  });

  it("une facture absente devient refusée : plus rien ne la bloque", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    await repo.markUncertain("o1", "timeout");
    expect(unwrap(await repo.resolveUncertain("o1", "absente")).state).toBe("refusee");
    expect((await repo.resolveUncertain("o1", "absente")).ok).toBe(false);
  });

  it("ne tranche que les factures incertaines", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    expect((await repo.resolveUncertain("o1", "absente")).ok).toBe(false);
  });
});

describe("recordCleanupIssue", () => {
  it("écrit le code sans changer l'état de la ligne", async () => {
    unwrap(await repo.claimInvoiceSlot(input));
    unwrap(await repo.markCreated("o1", { invoiceUuid: "u", systemInvoiceNumber: "N1" }));
    unwrap(await repo.recordCleanupIssue("o1", "non_brouillon"));
    expect(rows.get("o1")).toMatchObject({ state: "creee", lastErrorCode: "non_brouillon", invoiceUuid: "u" });
  });

  it("échoue pour un essai inconnu", async () => {
    expect((await repo.recordCleanupIssue("inconnu", "gardee")).ok).toBe(false);
  });
});
