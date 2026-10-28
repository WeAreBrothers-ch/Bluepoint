import { describe, expect, it } from "vitest";
import { d, task } from "./fixtures";
import { bottleCountText, deliveryDateText, modeLabel, PAYMENT_LABELS, urgencyBadge } from "./labels";
import { scheduleTask } from "./urgency";

const today = d("2026-10-21");
const at = (overrides: Parameters<typeof task>[0]) => scheduleTask(task(overrides), today);

describe("libellés de l'agenda", () => {
  it("parle de paiement en mots simples", () => {
    expect(PAYMENT_LABELS.PENDING).toEqual({ label: "Pas encore payée", tone: "warning" });
  });

  it("nomme les modes et l'action qui confirme la remise", () => {
    expect(modeLabel("poste").label).toBe("Envoi par la Poste");
    expect(modeLabel("retrait").doneAction).toBe("C’est retiré");
    expect(modeLabel(null).doneAction).toBe("C’est livré");
    expect(modeLabel("livraison").doneQuestion("#1042")).toBe("La commande #1042 est-elle bien livrée ?");
  });

  it("écrit la date de livraison en toutes lettres", () => {
    expect(deliveryDateText(at({ requestedDate: d("2026-10-21") }), today)).toBe("À livrer aujourd’hui");
    expect(deliveryDateText(at({ requestedDate: d("2026-10-22") }), today)).toBe("À livrer demain (jeudi 22 octobre)");
    expect(deliveryDateText(at({ requestedDate: d("2026-10-23"), deadline: d("2026-10-24") }), today)).toBe(
      "À livrer le vendredi 23 octobre (au plus tard le samedi 24 octobre)",
    );
    expect(deliveryDateText(at({ deadline: d("2026-10-19") }), today)).toBe(
      "Devait être livrée au plus tard le lundi 19 octobre",
    );
    expect(deliveryDateText(at({ requestedDate: d("2026-10-20"), deadline: d("2026-10-21") }), today)).toBe(
      "À livrer aujourd’hui",
    );
    expect(deliveryDateText(at({}), today)).toBe("Date de livraison à fixer avec le client");
  });

  it("donne un badge parlant à chaque urgence", () => {
    expect(urgencyBadge(at({ requestedDate: d("2026-10-22") }), today).label).toBe("Demain");
    expect(urgencyBadge(at({ requestedDate: d("2026-10-28") }), today).label).toBe("Prévue");
    expect(urgencyBadge(at({}), today).label).toBe("Date à fixer");
    expect(urgencyBadge(at({ deadline: d("2026-10-19") }), today).label).toBe("En retard");
  });

  it("accorde le nombre de bouteilles", () => {
    expect(bottleCountText(1)).toBe("1 bouteille");
    expect(bottleCountText(8)).toBe("8 bouteilles");
  });
});
