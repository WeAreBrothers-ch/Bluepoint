import { describe, expect, it } from "vitest";
import { trialAddress, trialClientName, trialReference } from "./trial-fixtures";

describe("client d'essai unique à chaque essai", () => {
  const first = trialReference(new Date("2026-11-10T12:05:30Z"));
  const second = trialReference(new Date("2026-11-10T12:06:45Z"));

  it("deux essais n'ont ni le même nom ni le même e-mail (aucun doublon possible)", () => {
    expect(trialClientName(first)).not.toBe(trialClientName(second));
    expect(trialAddress(first).email).not.toBe(trialAddress(second).email);
  });

  it("le nom porte l'horodatage de l'essai et reste reconnaissable à supprimer", () => {
    expect(trialClientName(first)).toBe("Client essai BluePoint 20261110-120530 (à supprimer)");
    expect(trialAddress(first).email).toBe("essai-20261110-120530@example.com");
  });
});
