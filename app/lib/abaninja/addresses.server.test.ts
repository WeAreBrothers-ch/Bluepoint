import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAddress, DuplicateAddressError } from "./addresses.server";
import type { AddressInput } from "./address-input";
import { emptyResponse, jsonResponse, scriptedFetch, TEST_ACCOUNT_UUID, TEST_TOKEN, testConfig } from "./test-support";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));

const COMPANY_UUID = "33333333-3333-4333-8333-333333333333";
const POSTAL_UUID = "22222222-2222-4222-8222-222222222222";
const SECRET_NAME = "Cave Dupont & Fils SA";

const company: AddressInput = {
  kind: "company",
  name: SECRET_NAME,
  street: "Rue du Lac",
  streetNumber: "12",
  zipCode: "1800",
  state: "VD",
  city: "Vevey",
  email: "contact@cave-dupont.ch",
  phone: "+41 21 555 12 34",
  vatNumber: "CHE-123.456.789 TVA",
  language: "fr",
};

const person: AddressInput = {
  kind: "person",
  firstName: "Marie",
  lastName: "Martin",
  salutation: "Ms",
  street: "Chemin Vert",
  zipCode: "1000",
  state: "VD",
  city: "Lausanne",
  email: "marie@example.ch",
  language: "de",
};

const created = { data: { uuid: COMPANY_UUID, addresses: [{ uuid: POSTAL_UUID }] }, message: "ok", status: 201 };

beforeEach(() => {
  logs.info.mockClear();
  logs.error.mockClear();
});

describe("createAddress : cas nominaux", () => {
  it("crée une société en snake_case, avec tag, CH par défaut, sans force", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse(created, 201)]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(result).toEqual({ ok: true, value: { addressUuid: POSTAL_UUID, companyUuid: COMPANY_UUID } });
    expect(calls[0]?.url).toBe(`https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/addresses/v2/addresses`);
    expect(calls[0]?.init.method).toBe("POST");
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body).toMatchObject({
      type: "company",
      name: SECRET_NAME,
      vat_number: "CHE-123.456.789 TVA",
      language: "fr",
      tags: ["bluepoint-app"],
      addresses: [{ address: "Rue du Lac", street_number: "12", zip_code: "1800", state: "VD", city: "Vevey", country_code: "CH" }],
      contacts: [
        { type: "email", value: "contact@cave-dupont.ch", primary: true },
        { type: "phone", value: "+41 21 555 12 34", primary: true },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("force");
  });

  it("refuse une adresse sans canton avant tout appel réseau (AbaNinja le réclame)", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse(created, 201)]);
    const { state: _canton, ...withoutState } = company;
    const result = await createAddress(testConfig(), withoutState as typeof company, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("sans l'option force, l'adresse du client n'envoie jamais force ; avec, elle l'ajoute en paramètre", async () => {
    const normal = scriptedFetch([jsonResponse(created, 201)]);
    await createAddress(testConfig(), company, { fetchImpl: normal.fetchImpl });
    expect(normal.calls[0]?.url).not.toContain("force");
    const forced = scriptedFetch([jsonResponse(created, 201)]);
    await createAddress(testConfig(), company, { fetchImpl: forced.fetchImpl, force: true });
    expect(forced.calls[0]?.url).toContain("addresses?force=true");
  });

  it("crée une personne et renvoie personUuid", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse(created, 201)]);
    const result = await createAddress(testConfig(), person, { fetchImpl });
    expect(result).toEqual({ ok: true, value: { addressUuid: POSTAL_UUID, personUuid: COMPANY_UUID } });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ type: "person", first_name: "Marie", salutation: "Ms" });
  });

  it("échoue clairement si la réponse n'a pas d'adresse postale", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: { uuid: COMPANY_UUID } }, 201)]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(!result.ok && result.error.message).toContain("sans adresse postale");
  });
});

describe("createAddress : entrées invalides refusées avant tout appel réseau", () => {
  it.each([
    ["nom vide", { ...company, name: "   " }],
    ["nom trop long", { ...company, name: "x".repeat(151) }],
    ["caractère de contrôle", { ...company, street: "Rue\u0000du Lac" }],
    ["retour à la ligne", { ...company, city: "Vevey\nSuisse" }],
    ["e-mail invalide", { ...company, email: "pas-un-email" }],
    ["téléphone invalide", { ...company, phone: "appelez-moi" }],
    ["TVA invalide", { ...company, vatNumber: "CHE<script>" }],
    ["langue inconnue", { ...company, language: "es" }],
    ["pays invalide", { ...company, countryCode: "suisse" }],
    ["type inconnu", { ...company, kind: "robot" }],
  ])("%s", async (_label, input) => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse(created, 201)]);
    const result = await createAddress(testConfig(), input as unknown as AddressInput, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("le message d'erreur nomme les champs sans citer les données", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse(created, 201)]);
    const result = await createAddress(testConfig(), { ...company, email: "secret-client.ch", name: "" }, { fetchImpl });
    const message = !result.ok ? result.error.message : "";
    expect(message).toContain("email");
    expect(message).not.toContain("secret-client.ch");
  });
});

describe("createAddress : erreurs HTTP", () => {
  it("409 : erreur distincte de doublon, sans réessai", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse([{ uuid: COMPANY_UUID, name: SECRET_NAME }], 409)]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(!result.ok && result.error).toBeInstanceOf(DuplicateAddressError);
    expect(!result.ok && result.error.message).not.toContain(SECRET_NAME);
    expect(calls).toHaveLength(1);
  });

  it.each([
    [400, "donnees_refusees"],
    [401, "non_autorise"],
    [403, "non_autorise"],
    [404, "introuvable"],
    [500, "indisponible"],
  ] as const)("statut %i -> %s, sans réessai (POST)", async (status, code) => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ error: "x", error_description: SECRET_NAME }, status)]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(!result.ok && result.error.code).toBe(code);
    expect(!result.ok && result.error).not.toBeInstanceOf(DuplicateAddressError);
    expect(calls).toHaveLength(1);
    expect(!result.ok && result.error.message).not.toContain(SECRET_NAME);
    expect(!result.ok && result.error.message).not.toContain(TEST_TOKEN);
  });

  it("n'écrit aucune donnée client dans les journaux", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse(created, 201)]);
    await createAddress(testConfig(), company, { fetchImpl });
    expect(JSON.stringify([logs.info.mock.calls, logs.error.mock.calls])).not.toMatch(/Dupont|cave-dupont|Vevey/);
  });

  it("un délai dépassé est une erreur d'indisponibilité", async () => {
    const { fetchImpl } = scriptedFetch([Object.assign(new Error("t"), { name: "TimeoutError" })]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("indisponible");
  });

  it("une réponse vide est invalide", async () => {
    const { fetchImpl } = scriptedFetch([emptyResponse(201)]);
    const result = await createAddress(testConfig(), company, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });
});
