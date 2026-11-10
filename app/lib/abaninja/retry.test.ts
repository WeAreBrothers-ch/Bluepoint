import { describe, expect, it } from "vitest";
import { isRetryableMethod, MAX_DELAY_MS, parseRetryAfterMs, retryDelayMs, sleep } from "./retry";

describe("isRetryableMethod", () => {
  it("réessaie GET, jamais POST, PATCH seulement si sûr", () => {
    expect(isRetryableMethod("GET", false)).toBe(true);
    expect(isRetryableMethod("POST", true)).toBe(false);
    expect(isRetryableMethod("PATCH", false)).toBe(false);
    expect(isRetryableMethod("PATCH", true)).toBe(true);
  });
});

describe("parseRetryAfterMs", () => {
  it("lit des secondes", () => expect(parseRetryAfterMs("3", 0)).toBe(3000));
  it("lit une date HTTP", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:05 GMT", now)).toBe(5000);
  });
  it("ignore une valeur absente ou illisible", () => {
    expect(parseRetryAfterMs(null, 0)).toBeUndefined();
    expect(parseRetryAfterMs("bientôt", 0)).toBeUndefined();
  });
});

describe("retryDelayMs", () => {
  it("croît de façon exponentielle avec une gigue", () => {
    expect(retryDelayMs(0, undefined, () => 0)).toBe(500);
    expect(retryDelayMs(1, undefined, () => 0)).toBe(1000);
    expect(retryDelayMs(1, undefined, () => 1)).toBe(1500);
  });
  it("respecte Retry-After mais le plafonne", () => {
    expect(retryDelayMs(0, 2000, () => 0)).toBe(2000);
    expect(retryDelayMs(0, 3_600_000, () => 0)).toBe(MAX_DELAY_MS);
  });
});

describe("sleep", () => {
  it("se termine tout de suite si le signal est déjà déclenché", async () => {
    const controller = new AbortController();
    controller.abort();
    const startedAt = Date.now();
    await sleep(5_000, controller.signal);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it("se termine dès que le signal est déclenché pendant la pause", async () => {
    const controller = new AbortController();
    const pending = sleep(5_000, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
  });
});
