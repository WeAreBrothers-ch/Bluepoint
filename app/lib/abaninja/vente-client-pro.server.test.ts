import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { PRO_TEST_CLIENT_NAME, testClientAddress } from "./vente-positions";

/** Le client pro fictif : créé une seule fois dans AbaNinja, puis repris par chaque bon et chaque facture d'essai d'un pro. */

const deps = vi.hoisted(() => ({
  claimProClient: vi.fn(),
  retakeStaleProClient: vi.fn(),
  saveProClient: vi.fn(),
  releaseProClient: vi.fn(),
  markProClientUncertain: vi.fn(),
  createAddress: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: deps.logInfo, logError: deps.logError }));
vi.mock("./addresses.server", () => ({ createAddress: deps.createAddress }));
vi.mock("./vente-client-pro-repository.server", () => ({
  claimProClient: deps.claimProClient,
  retakeStaleProClient: deps.retakeStaleProClient,
  saveProClient: deps.saveProClient,
  releaseProClient: deps.releaseProClient,
  markProClientUncertain: deps.markProClientUncertain,
}));

const { proTestClient } = await import("./vente-client-pro.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
const CONFIG_VALUE = CONFIG.ok ? CONFIG.value : expect.unreachable("configuration d’essai invalide");

const SHOP = "test.myshopify.com";
const NOW = new Date("2026-11-19T12:00:00Z");
const ADDRESS = testClientAddress(PRO_TEST_CLIENT_NAME, "client-pro-fictif@example.com");
const CLIENT = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };

function row(state: string, updatedAt: Date, ids: Partial<typeof CLIENT> = {}) {
  return { shop: SHOP, kind: "pro", state, addressUuid: ids.addressUuid ?? null, companyUuid: ids.companyUuid ?? null, createdAt: updatedAt, updatedAt };
}

function alreadyTaken(state: string, updatedAt: Date, ids: Partial<typeof CLIENT> = {}) {
  deps.claimProClient.mockResolvedValue(success({ client: row(state, updatedAt, ids), claimed: false }));
}

const run = () => proTestClient(CONFIG_VALUE, SHOP, ADDRESS, NOW);

beforeEach(() => {
  vi.clearAllMocks();
  deps.claimProClient.mockResolvedValue(success({ client: row("en_cours", NOW), claimed: true }));
  deps.retakeStaleProClient.mockResolvedValue(success(true));
  deps.saveProClient.mockResolvedValue(success(true));
  deps.releaseProClient.mockResolvedValue(success(undefined));
  deps.markProClientUncertain.mockResolvedValue(success(undefined));
  deps.createAddress.mockResolvedValue(success(CLIENT));
});

describe("client pro fictif", () => {
  it("la première fois : il est créé dans AbaNinja, puis gardé", async () => {
    expect(await run()).toEqual(success(CLIENT));
    expect(deps.createAddress).toHaveBeenCalledWith(CONFIG_VALUE, ADDRESS, { force: true });
    expect(deps.saveProClient).toHaveBeenCalledWith(SHOP, CLIENT);
  });

  it("les fois suivantes : le même client, sans rien créer dans AbaNinja", async () => {
    alreadyTaken("cree", new Date("2026-11-18T09:00:00Z"), CLIENT);
    expect(await run()).toEqual(success(CLIENT));
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("une autre commande le crée en ce moment : rien n'est créé en double, réessayer dans un instant", async () => {
    alreadyTaken("en_cours", new Date("2026-11-19T11:59:30Z"));
    expect(await run()).toMatchObject({ ok: false, error: { message: expect.stringContaining("Réessayez dans un instant") } });
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("une création restée en plan depuis plus de deux minutes est reprise", async () => {
    alreadyTaken("en_cours", new Date("2026-11-19T11:55:00Z"));
    expect(await run()).toEqual(success(CLIENT));
    expect(deps.retakeStaleProClient).toHaveBeenCalledWith(SHOP, new Date("2026-11-19T11:58:00Z"), NOW);
    expect(deps.createAddress).toHaveBeenCalledTimes(1);
  });

  it("reprise gagnée par un autre appelant : rien n'est créé en double", async () => {
    alreadyTaken("en_cours", new Date("2026-11-19T11:55:00Z"));
    deps.retakeStaleProClient.mockResolvedValue(success(false));
    expect(await run()).toMatchObject({ ok: false });
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("refusé par AbaNinja : la réservation est rendue, le refus est expliqué", async () => {
    deps.createAddress.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    expect(await run()).toMatchObject({ ok: false, error: { message: expect.stringContaining("AbaNinja n’a pas créé le client pro fictif") } });
    expect(deps.releaseProClient).toHaveBeenCalledWith(SHOP);
    expect(deps.saveProClient).not.toHaveBeenCalled();
  });

  it("réponse incertaine : le client est noté « à vérifier » (pas rendu), pour ne jamais en créer un second", async () => {
    deps.createAddress.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await run()).toMatchObject({ ok: false, error: { code: "client_pro_incertain", message: expect.stringContaining("Effacer les factures d’essai") } });
    expect(deps.markProClientUncertain).toHaveBeenCalledWith(SHOP);
    expect(deps.releaseProClient).not.toHaveBeenCalled();
  });

  it("client « à vérifier » : rien n'est recréé tant que l'effacement des essais ne l'a pas réglé", async () => {
    alreadyTaken("incertain", new Date("2026-11-19T09:00:00Z"));
    expect(await run()).toMatchObject({ ok: false, error: { code: "client_pro_incertain" } });
    expect(deps.createAddress).not.toHaveBeenCalled();
    expect(deps.retakeStaleProClient).not.toHaveBeenCalled();
  });

  it("AbaNinja crée une personne au lieu d'une entreprise : pas gardée, à supprimer à la main", async () => {
    deps.createAddress.mockResolvedValue(success({ addressUuid: CLIENT.addressUuid, personUuid: CLIENT.companyUuid }));
    expect(await run()).toMatchObject({ ok: false, error: { code: "client_personne", message: expect.stringContaining("personne") } });
    expect(deps.releaseProClient).toHaveBeenCalledWith(SHOP);
  });

  it("créé mais pas gardé par l'app : il sert quand même à cette pièce, et c'est noté au journal", async () => {
    deps.saveProClient.mockResolvedValue(failure(new Error("base injoignable")));
    expect(await run()).toEqual(success(CLIENT));
    expect(deps.logError).toHaveBeenCalledWith("Client pro fictif créé dans AbaNinja mais non gardé", expect.any(Error), { shop: SHOP });
  });

  it("la base ne répond pas : rien n'est demandé à AbaNinja", async () => {
    deps.claimProClient.mockResolvedValue(failure(new Error("base injoignable")));
    expect(await run()).toMatchObject({ ok: false, error: { message: expect.stringContaining("Réessayez") } });
    expect(deps.createAddress).not.toHaveBeenCalled();
  });
});
