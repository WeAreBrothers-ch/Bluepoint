import { describe, expect, it } from "vitest";
import { isUuid } from "./uuid";

describe("isUuid", () => {
  it.each([
    "123e4567-e89b-42d3-a456-426614174000",
    "00000000-0000-0000-0000-000000000000",
    "123E4567-E89B-12D3-C456-426614174000",
    "9b2c1f4e-7a3d-9c8b-1e5f-0a1b2c3d4e5f",
  ])("accepte un UUID bien formé de toute version ou variante : %s", (value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    "",
    "pas-un-uuid",
    "123e4567-e89b-42d3-a456-42661417400",
    "123e4567-e89b-42d3-a456-4266141740000",
    "../123e4567-e89b-42d3-a456-426614174000",
    "123e4567-e89b-42d3-a456-426614174000/..",
    "123e4567-e89b-42d3-a456-426614174000?x=1",
    "123e4567-e89b-42d3-a456-42661417400g",
    "123e4567-e89b-42d3-a456-426614174000\n",
  ])("refuse : %j", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});
