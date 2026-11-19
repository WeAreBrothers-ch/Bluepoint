import { describe, expect, it } from "vitest";
import { mentionAcquittee } from "./paiement";

describe("mentionAcquittee", () => {
  it("garde le texte du reçu payé en ligne", () => {
    expect(mentionAcquittee("Payée en ligne", "2026-10-21")).toBe(
      "Facture acquittée : payée en ligne le 21.10.2026. Aucun paiement supplémentaire n’est dû.",
    );
  });

  it("ne dit pas « en ligne » quand le paiement a pu se faire autrement", () => {
    expect(mentionAcquittee("Payée", "2026-11-10")).toBe("Facture acquittée : payée le 10.11.2026. Aucun paiement supplémentaire n’est dû.");
  });
});
