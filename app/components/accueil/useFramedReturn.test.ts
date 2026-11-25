import { describe, expect, it } from "vitest";
import { claimReturn, RETURN_PAUSE_MS } from "./useFramedReturn";

/** Le garde-fou du retour automatique : jamais plus d'un retour par minute, rien si le navigateur refuse le stockage. */

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("claimReturn", () => {
  it("laisse partir le premier retour, puis bloque les suivants pendant une minute", () => {
    const storage = memoryStorage();
    const start = 1_800_000_000_000;
    expect(claimReturn(() => storage, start)).toBe(true);
    expect(claimReturn(() => storage, start + 1_000)).toBe(false);
    expect(claimReturn(() => storage, start + RETURN_PAUSE_MS - 1)).toBe(false);
    expect(claimReturn(() => storage, start + RETURN_PAUSE_MS)).toBe(true);
  });

  it("ne repart pas tout seul si le stockage est refusé", () => {
    const refused = () => {
      throw new Error("SecurityError");
    };
    expect(claimReturn(refused, Date.now())).toBe(false);
  });

  it("ignore une valeur illisible et laisse partir le retour", () => {
    const storage = memoryStorage();
    storage.setItem("bp-accueil-retour", "pas un nombre");
    expect(claimReturn(() => storage, Date.now())).toBe(true);
  });
});
