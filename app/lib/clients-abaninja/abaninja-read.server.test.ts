import { describe, expect, it, vi } from "vitest";
import { emptyResponse, jsonResponse, scriptedFetch, TEST_ACCOUNT_UUID, testConfig } from "../abaninja/test-support";
import { listAbaNinjaCards } from "./abaninja-read.server";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function page(data: unknown[], lastPage: number) {
  return jsonResponse({ data, meta: { current_page: 1, last_page: lastPage } });
}

describe("listAbaNinjaCards", () => {
  it("lit toutes les pages des sociétés puis des personnes", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      page([{ uuid: A, name: "Restaurant du Lac" }], 2),
      page([{ uuid: B, name: "Hôtel du Parc" }], 2),
      page([{ uuid: C, first_name: "Luc", last_name: "Favre" }], 1),
    ]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(result.ok && result.value.cards.map((card) => [card.uuid, card.kind])).toEqual([
      [A, "company"],
      [B, "company"],
      [C, "person"],
    ]);
    expect(result.ok && result.value.truncated).toBe(false);
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/addresses/v2/companies?page=1&limit=100`,
      `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/addresses/v2/companies?page=2&limit=100`,
      `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/addresses/v2/persons?page=1&limit=100`,
    ]);
  });

  it("saute et compte les fiches illisibles ou sans nom", async () => {
    const { fetchImpl } = scriptedFetch([page([{ uuid: A, name: "Bar" }, { name: "Sans uuid" }, { uuid: B, name: " " }], 1), page([], 1)]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(result.ok && result.value.cards.map((card) => card.uuid)).toEqual([A]);
    expect(result.ok && result.value.skipped).toBe(2);
  });

  it("continue jusqu'à une page vide quand AbaNinja ne dit pas combien il y en a (il peut rendre moins de 100 fiches par page)", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      jsonResponse({ data: [{ uuid: A, name: "Bar" }] }),
      jsonResponse({ data: [{ uuid: B, name: "Café" }] }),
      jsonResponse({ data: [] }),
      jsonResponse({ data: [] }),
    ]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(result.ok && result.value.cards.map((card) => card.uuid)).toEqual([A, B]);
    expect(calls).toHaveLength(4);
  });

  it("lit un nombre de pages écrit en texte", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      jsonResponse({ data: [{ uuid: A, name: "Bar" }], meta: { last_page: "1" } }),
      jsonResponse({ data: [], meta: { last_page: "1" } }),
    ]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(result.ok && result.value.cards).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });

  it("signale une liste coupée au-delà de 20 pages", async () => {
    const { fetchImpl, calls } = scriptedFetch([page([{ uuid: A, name: "Bar" }], 25)]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(result.ok && result.value.truncated).toBe(true);
    expect(calls).toHaveLength(40);
  });

  it("renvoie l'erreur d'AbaNinja telle quelle", async () => {
    const { fetchImpl } = scriptedFetch([emptyResponse(401)]);
    const result = await listAbaNinjaCards(testConfig(), { fetchImpl });
    expect(!result.ok && result.error.code).toBe("non_autorise");
  });
});
