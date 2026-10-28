import { describe, expect, it } from "vitest";
import { failure, success } from "../core/result";
import { collectPages, type Page } from "./paginate";

function pages(total: number, size: number) {
  const calls: { after: string | null; first: number }[] = [];
  const fetchPage = async (after: string | null, first: number) => {
    calls.push({ after, first });
    const start = after === null ? 0 : Number(after);
    const items = Array.from({ length: Math.min(first, Math.max(total - start, 0)) }, (_, i) => start + i);
    const end = start + items.length;
    const page: Page<number> = { items, hasNextPage: end < total, endCursor: String(end) };
    return success(page);
  };
  return { fetchPage, calls, size };
}

describe("collectPages", () => {
  it("lit toutes les pages sous le plafond", async () => {
    const { fetchPage, calls } = pages(120, 50);
    const result = await collectPages(fetchPage, 50, 300);
    expect(result.ok && result.value.items.length).toBe(120);
    expect(result.ok && result.value.truncated).toBe(false);
    expect(calls.map((c) => c.after)).toEqual([null, "50", "100"]);
  });

  it("s'arrête au plafond et le signale", async () => {
    const { fetchPage, calls } = pages(500, 50);
    const result = await collectPages(fetchPage, 50, 120);
    expect(result.ok && result.value.items.length).toBe(120);
    expect(result.ok && result.value.truncated).toBe(true);
    expect(calls.at(-1)?.first).toBe(20);
  });

  it("n'annonce pas de coupure quand le plafond tombe pile sur la fin", async () => {
    const { fetchPage } = pages(100, 50);
    const result = await collectPages(fetchPage, 50, 100);
    expect(result.ok && result.value.truncated).toBe(false);
  });

  it("remonte l'erreur d'une page", async () => {
    const result = await collectPages(async () => failure(new Error("réseau")), 50, 100);
    expect(result.ok).toBe(false);
  });
});
