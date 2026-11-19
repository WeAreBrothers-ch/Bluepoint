import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";

/** À la fin de « Effacer les factures d'essai » : le client pro fictif part une seule fois, quand plus rien ne s'en sert. */

const deps = vi.hoisted(() => ({ deleteCompany: vi.fn(), forgetProClient: vi.fn(), dropProClientReservation: vi.fn(), logError: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: deps.logError }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: deps.deleteCompany }));
vi.mock("./vente-client-pro-repository.server", () => ({ forgetProClient: deps.forgetProClient, dropProClientReservation: deps.dropProClientReservation }));

const { eraseProTestClient } = await import("./vente-client-pro-effacer.server");

const SHOP = "test.myshopify.com";
const NOW = new Date("2026-11-19T15:00:00Z");
const COMPANY = "33333333-3333-4333-8333-333333333333";
const NAME = "« Client pro fictif · essai BluePoint »";

function client(state = "cree", updatedAt = new Date("2026-11-19T11:00:00Z")) {
  const ids = state === "cree" ? { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: COMPANY } : { addressUuid: null, companyUuid: null };
  return { shop: SHOP, kind: "pro", state, ...ids, createdAt: updatedAt, updatedAt };
}

const erase = (row: ReturnType<typeof client> | null, othersErased = true) => eraseProTestClient(testConfig(), row, othersErased, NOW);

beforeEach(() => {
  vi.clearAllMocks();
  deps.deleteCompany.mockResolvedValue(success(undefined));
  deps.forgetProClient.mockResolvedValue(success(undefined));
  deps.dropProClientReservation.mockResolvedValue(success(true));
});

describe("effacer le client pro fictif", () => {
  it("pas de client pro fictif : rien à dire", async () => {
    expect(await erase(null)).toBeNull();
    expect(deps.deleteCompany).not.toHaveBeenCalled();
  });

  it("tout le reste est effacé : il part d'AbaNinja, puis l'app l'oublie", async () => {
    expect(await erase(client())).toEqual({ kind: "effacee", text: "Client pro fictif effacé." });
    expect(deps.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(deps.forgetProClient).toHaveBeenCalledWith(SHOP, COMPANY);
  });

  it("déjà supprimé dans AbaNinja : l'app l'oublie aussi", async () => {
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("introuvable", { status: 404 })));
    expect(await erase(client())).toEqual({ kind: "effacee", text: "Client pro fictif effacé." });
    expect(deps.forgetProClient).toHaveBeenCalledWith(SHOP, COMPANY);
  });

  it("une pièce d'essai reste : il n'est pas touché, il partira au prochain effacement", async () => {
    expect(await erase(client(), false)).toMatchObject({ kind: "gardee", text: expect.stringContaining("prochain effacement") });
    expect(deps.deleteCompany).not.toHaveBeenCalled();
  });

  it("AbaNinja dit qu'une pièce s'en sert encore (409) : il est gardé, Eliott sait quoi faire", async () => {
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 409 })));
    const outcome = await erase(client());
    expect(outcome).toMatchObject({ kind: "a_la_main", text: expect.stringContaining(`${NAME} reste dans AbaNinja : une pièce s’en sert encore`) });
    expect(outcome?.text).toContain("Il continue de servir aux prochains essais");
    expect(deps.forgetProClient).not.toHaveBeenCalled();
  });

  it("AbaNinja ne répond pas : gardé pour réessayer", async () => {
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await erase(client())).toMatchObject({ kind: "gardee", text: expect.stringContaining("Réessayez dans un instant") });
    expect(deps.forgetProClient).not.toHaveBeenCalled();
  });

  it("AbaNinja refuse autrement : à supprimer à la main, et l'app ne s'en sert plus", async () => {
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("non_autorise", { status: 403 })));
    expect(await erase(client())).toEqual({ kind: "a_la_main", text: `Le client pro fictif ${NAME} reste dans AbaNinja : supprimez-le à la main.` });
    expect(deps.forgetProClient).toHaveBeenCalledWith(SHOP, COMPANY);
  });

  it("effacé dans AbaNinja mais pas oublié par l'app : gardé pour réessayer", async () => {
    deps.forgetProClient.mockResolvedValue(failure(new Error("base injoignable")));
    expect(await erase(client())).toMatchObject({ kind: "gardee", text: expect.stringContaining("réessayez") });
  });

  it("resté en plan ou « à vérifier » : l'app l'oublie (seulement s'il l'est encore) et dit quoi chercher", async () => {
    expect(await erase(client("incertain"))).toEqual({ kind: "a_la_main", text: `Cherchez dans AbaNinja un client ${NAME} et supprimez-le s’il existe.` });
    expect(deps.dropProClientReservation).toHaveBeenCalledWith(SHOP, new Date("2026-11-19T14:58:00Z"));
  });

  it("en train d'être créé (ou fini entre-temps) : rien n'est oublié, rien à supprimer à la main", async () => {
    deps.dropProClientReservation.mockResolvedValue(success(false));
    expect(await erase(client("en_cours", new Date("2026-11-19T14:59:30Z")))).toMatchObject({ kind: "gardee", text: expect.stringContaining("réessayez") });
  });
});
