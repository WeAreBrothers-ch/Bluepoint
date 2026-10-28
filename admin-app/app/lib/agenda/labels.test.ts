import { describe, expect, it } from "vitest";
import { d, task } from "./fixtures";
import { deadlineText, modeLabel, PAYMENT_LABELS, requestedText } from "./labels";
import { scheduleTask } from "./urgency";

const today = d("2026-10-21");

describe("libellés de l'agenda", () => {
  it("affiche le bon de commande non payé", () => {
    expect(PAYMENT_LABELS.PENDING).toEqual({ label: "Bon de commande — non payé", tone: "warning" });
  });

  it("nomme les modes de livraison", () => {
    expect(modeLabel("poste").label).toBe("Poste");
    expect(modeLabel(null).label).toBe("Mode à préciser");
  });

  it("formate l'échéance à la suisse avec espace fine", () => {
    const withBoth = scheduleTask(task({ requestedDate: d("2026-10-22"), deadline: d("2026-10-24") }), today);
    expect(deadlineText(withBoth)).toBe("Au plus tard : 24.10.2026");
    expect(requestedText(withBoth)).toBe("Souhaitée le : 22.10.2026");
    const fromCart = scheduleTask(task({ requestedDate: d("2026-10-22"), dateSource: "attribut" }), today);
    expect(deadlineText(fromCart)).toBe("Souhaitée le : 22.10.2026 (indiquée au panier)");
    expect(requestedText(fromCart)).toBeNull();
    expect(deadlineText(scheduleTask(task(), today))).toBe("Aucune date de livraison");
  });
});
