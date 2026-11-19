import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** La ligne du client pro fictif : prise une seule fois, et jamais écrasée par un appelant en retard. Base simulée en mémoire. */

interface Row {
  [key: string]: unknown;
  shop: string;
  kind: string;
  state: string;
  companyUuid: string | null;
  updatedAt: Date;
}

const rows = new Map<string, Row>();
const keyOf = (shop: string, kind: string) => `${shop}|${kind}`;

interface Condition {
  state?: string | { not: string };
  companyUuid?: string | null;
  updatedAt?: { lt: Date };
}

interface Where extends Condition {
  shop: string;
  kind: string;
  OR?: Condition[];
}

function stateMatches(state: string, wanted: Condition["state"]): boolean {
  if (wanted === undefined) return true;
  return typeof wanted === "string" ? state === wanted : state !== wanted.not;
}

function meets(row: Row, condition: Condition): boolean {
  if (!stateMatches(row.state, condition.state)) return false;
  if (condition.companyUuid !== undefined && row.companyUuid !== condition.companyUuid) return false;
  return condition.updatedAt === undefined || row.updatedAt < condition.updatedAt.lt;
}

function matches(row: Row | undefined, where: Where): row is Row {
  if (row === undefined || !meets(row, where)) return false;
  return where.OR === undefined || where.OR.some((condition) => meets(row, condition));
}

const fakePrisma = {
  abaNinjaTestClient: {
    create: vi.fn(async ({ data }: { data: { shop: string; kind: string; state: string } }) => {
      if (rows.has(keyOf(data.shop, data.kind))) throw new Prisma.PrismaClientKnownRequestError("doublon", { code: "P2002", clientVersion: "test" });
      const row: Row = { ...data, addressUuid: null, companyUuid: null, updatedAt: new Date("2026-11-19T12:00:00Z") };
      rows.set(keyOf(data.shop, data.kind), row);
      return { ...row };
    }),
    findUnique: vi.fn(async ({ where }: { where: { shop_kind: { shop: string; kind: string } } }) => {
      const row = rows.get(keyOf(where.shop_kind.shop, where.shop_kind.kind));
      return row === undefined ? null : { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const row = rows.get(keyOf(where.shop, where.kind));
      if (!matches(row, where)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Where }) => {
      const key = keyOf(where.shop, where.kind);
      if (!matches(rows.get(key), where)) return { count: 0 };
      rows.delete(key);
      return { count: 1 };
    }),
  },
};

vi.mock("../../db.server", () => ({ default: fakePrisma }));

const repository = await import("./vente-client-pro-repository.server");

const SHOP = "test.myshopify.com";
const CLIENT = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
const LATER = new Date("2026-11-19T12:05:00Z");

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("ligne du client pro fictif", () => {
  it("se prend une seule fois : le second appelant reçoit la ligne déjà prise", async () => {
    expect(await repository.claimProClient(SHOP)).toMatchObject({ ok: true, value: { claimed: true, client: { state: "en_cours" } } });
    expect(await repository.claimProClient(SHOP)).toMatchObject({ ok: true, value: { claimed: false, client: { state: "en_cours" } } });
  });

  it("garde le client créé, seulement si la création était réservée", async () => {
    expect(await repository.saveProClient(SHOP, CLIENT)).toEqual({ ok: true, value: false });
    await repository.claimProClient(SHOP);
    expect(await repository.saveProClient(SHOP, CLIENT)).toEqual({ ok: true, value: true });
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: true, value: { state: "cree", ...CLIENT } });
  });

  it("une création refusée rend la ligne ; un client déjà créé n'est jamais rendu ainsi", async () => {
    await repository.claimProClient(SHOP);
    await repository.releaseProClient(SHOP);
    expect(await repository.findProClient(SHOP)).toEqual({ ok: true, value: null });
    await repository.claimProClient(SHOP);
    await repository.saveProClient(SHOP, CLIENT);
    await repository.releaseProClient(SHOP);
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: true, value: { state: "cree" } });
  });

  it("création sans réponse claire : « à vérifier », et jamais rendue comme une création refusée", async () => {
    await repository.claimProClient(SHOP);
    await repository.markProClientUncertain(SHOP);
    await repository.releaseProClient(SHOP);
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: true, value: { state: "incertain", companyUuid: null } });
  });

  it("l'effacement oublie un client « à vérifier » ou une création restée en plan, jamais une création en cours", async () => {
    await repository.claimProClient(SHOP);
    expect(await repository.dropProClientReservation(SHOP, new Date("2026-11-19T11:59:00Z"))).toEqual({ ok: true, value: false });
    expect(await repository.dropProClientReservation(SHOP, new Date("2026-11-19T12:03:00Z"))).toEqual({ ok: true, value: true });
    await repository.claimProClient(SHOP);
    await repository.markProClientUncertain(SHOP);
    expect(await repository.dropProClientReservation(SHOP, new Date("2026-11-19T11:59:00Z"))).toEqual({ ok: true, value: true });
    expect(await repository.findProClient(SHOP)).toEqual({ ok: true, value: null });
  });

  it("l'effacement n'oublie jamais un client gardé par ce chemin", async () => {
    await repository.claimProClient(SHOP);
    await repository.saveProClient(SHOP, CLIENT);
    expect(await repository.dropProClientReservation(SHOP, LATER)).toEqual({ ok: true, value: false });
  });

  it("une création restée en plan se reprend une fois passé le délai, pas avant", async () => {
    await repository.claimProClient(SHOP);
    expect(await repository.retakeStaleProClient(SHOP, new Date("2026-11-19T11:59:00Z"), LATER)).toEqual({ ok: true, value: false });
    expect(await repository.retakeStaleProClient(SHOP, new Date("2026-11-19T12:03:00Z"), LATER)).toEqual({ ok: true, value: true });
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: true, value: { state: "en_cours", updatedAt: LATER } });
  });

  it("s'oublie après l'effacement de CE client seulement (pas d'un plus récent)", async () => {
    await repository.claimProClient(SHOP);
    await repository.saveProClient(SHOP, CLIENT);
    await repository.forgetProClient(SHOP, "44444444-4444-4444-8444-444444444444");
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: true, value: { state: "cree" } });
    await repository.forgetProClient(SHOP, CLIENT.companyUuid);
    expect(await repository.findProClient(SHOP)).toEqual({ ok: true, value: null });
  });

  it("une base qui ne répond pas devient une erreur, jamais une exception", async () => {
    fakePrisma.abaNinjaTestClient.findUnique.mockRejectedValueOnce(new Error("base injoignable"));
    expect(await repository.findProClient(SHOP)).toMatchObject({ ok: false });
  });
});
