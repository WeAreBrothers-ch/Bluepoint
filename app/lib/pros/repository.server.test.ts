import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProRequestInput } from "./request";

/** Base simulée en mémoire : demandes en attente, recherche d'e-mail sans tenir compte des majuscules. */
interface Row {
  [key: string]: unknown;
  id: string;
  shop: string;
  status: string;
  email: string;
}

const rows = new Map<string, Row>();

interface PendingWhere {
  readonly shop: string;
  readonly status: string;
  readonly email?: { readonly equals: string };
}

function matches(row: Row, where: PendingWhere): boolean {
  const sameEmail = where.email === undefined || row.email.toLowerCase() === where.email.equals.toLowerCase();
  return row.shop === where.shop && row.status === where.status && sameEmail;
}

const fakePrisma = {
  proRequest: {
    findFirst: vi.fn(async ({ where }: { where: PendingWhere }) => [...rows.values()].find((row) => matches(row, where)) ?? null),
    count: vi.fn(async ({ where }: { where: PendingWhere }) => [...rows.values()].filter((row) => matches(row, where)).length),
    create: vi.fn(async ({ data }: { data: { [key: string]: unknown; shop: string; email: string } }) => {
      const row: Row = { ...data, id: `req-${rows.size + 1}`, status: "en_attente" };
      rows.set(row.id, row);
      return { ...row };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.get(where.id);
      if (row === undefined) throw new Error("ligne absente");
      Object.assign(row, data);
      return { ...row };
    }),
  },
};

vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { saveProRequest } = await import("./repository.server");

const SHOP = "dummy-shop.myshopify.com";

const request: ProRequestInput = {
  companyName: "Restaurant Fictif",
  firstName: "Alice",
  lastName: "Test",
  email: "info@dummy-resto.test",
  phone: "+41790000001",
  street: "Rue Fictive 1",
  postalCode: "1095",
  city: "Lutry",
  country: "CH",
  vatNumber: null,
  message: null,
};

const stranger: ProRequestInput = { ...request, firstName: "Inconnu", phone: "+41790000099", street: "Chemin Inconnu 99", postalCode: "1000", city: "Lausanne" };

function onlyRow(): Row {
  const [row] = [...rows.values()];
  if (row === undefined || rows.size !== 1) throw new Error(`une seule demande attendue, ${rows.size} trouvée(s)`);
  return row;
}

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("saveProRequest depuis le site", () => {
  it("ne modifie jamais une demande en attente envoyée avec le même e-mail", async () => {
    const first = await saveProRequest(SHOP, request, "site");
    const second = await saveProRequest(SHOP, { ...stranger, email: "INFO@Dummy-Resto.test" }, "site");

    expect(second).toEqual(first);
    expect(onlyRow()).toMatchObject({ firstName: "Alice", phone: "+41790000001", street: "Rue Fictive 1", city: "Lutry" });
    expect(fakePrisma.proRequest.update).not.toHaveBeenCalled();
  });

  it("garde la première demande quand deux envois arrivent en même temps", async () => {
    await saveProRequest(SHOP, request, "site");
    const firstId = onlyRow().id;
    // Le second envoi ne voit pas encore la première demande, puis la base refuse le doublon (index unique).
    fakePrisma.proRequest.findFirst.mockResolvedValueOnce(null);
    fakePrisma.proRequest.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("doublon", { code: "P2002", clientVersion: "test" }));

    const second = await saveProRequest(SHOP, stranger, "site");

    expect(second).toEqual({ ok: true, id: firstId });
    expect(onlyRow()).toMatchObject({ phone: "+41790000001", street: "Rue Fictive 1" });
    expect(fakePrisma.proRequest.update).not.toHaveBeenCalled();
  });
});

describe("saveProRequest depuis l'app", () => {
  it("l'équipe peut corriger une demande en attente", async () => {
    await saveProRequest(SHOP, request, "site");

    await saveProRequest(SHOP, { ...request, phone: "+41790000002" }, "app");

    expect(onlyRow()).toMatchObject({ phone: "+41790000002" });
  });
});
