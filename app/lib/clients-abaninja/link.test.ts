import { describe, expect, it } from "vitest";
import { parseLink, parseUuidList, serializeLink, serializeUuidList } from "./link";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER = "223e4567-e89b-42d3-a456-426614174000";

describe("lien AbaNinja", () => {
  it("relit ce qu'il a écrit", () => {
    const link = { uuid: UUID, kind: "company" as const, number: "A0153" };
    expect(parseLink(serializeLink(link))).toEqual(link);
  });

  it("ignore une valeur illisible ou incomplète", () => {
    expect(parseLink("{oops")).toBeNull();
    expect(parseLink(JSON.stringify({ uuid: "pas-un-uuid", kind: "company", number: null }))).toBeNull();
    expect(parseLink(JSON.stringify({ uuid: UUID, kind: "autre", number: null }))).toBeNull();
    expect(parseLink(null)).toBeNull();
  });
});

describe("liste d'uuid", () => {
  it("garde les uuid valides, sans doublon, en minuscules", () => {
    expect(parseUuidList(JSON.stringify([UUID, "x", UUID.toUpperCase(), 3, OTHER]))).toEqual([UUID, OTHER]);
  });

  it("renvoie une liste vide quand la valeur manque ou est illisible", () => {
    expect(parseUuidList(undefined)).toEqual([]);
    expect(parseUuidList("{}")).toEqual([]);
  });

  it("écrit une liste relisible", () => {
    expect(parseUuidList(serializeUuidList([OTHER, UUID]))).toEqual([OTHER, UUID]);
  });
});
