import { describe, expect, it } from "vitest";
import { d, task } from "./fixtures";
import { orderSummary } from "./summary";
import { scheduleTask } from "./urgency";

const today = d("2026-10-28");
const at = (overrides: Parameters<typeof task>[0]) => scheduleTask(task(overrides), today);
const invoice = { number: "BP-2026-0004", viewUrl: "https://exemple.ch/partage/x" };

describe("résumé BluePoint d'une commande", () => {
  it("dit quand et comment, avec le bon verbe", () => {
    expect(orderSummary(at({ requestedDate: d("2026-10-29") }), today, null)).toMatchObject({
      headline: "À livrer demain (jeudi 29 octobre)",
      headlineTone: "info",
      mode: "Livraison",
    });
    expect(orderSummary(at({ requestedDate: today, mode: "poste" }), today, null).headline).toBe("À envoyer aujourd’hui");
    expect(orderSummary(at({ requestedDate: today, mode: "retrait" }), today, null).headline).toBe("À préparer pour le retrait aujourd’hui");
  });

  it("signale le retard et la date à choisir", () => {
    const late = orderSummary(at({ requestedDate: d("2026-10-26"), deadline: d("2026-10-27") }), today, null);
    expect(late).toMatchObject({ headline: "Devait être livrée au plus tard le mardi 27 octobre", headlineTone: "critical" });
    const undated = orderSummary(at({}), today, null);
    expect(undated.headline).toBe("Jour de livraison pas encore choisi");
    expect(undated.nextStep).toMatch(/Choisir le jour/);
  });

  it("guide vers la seule action utile", () => {
    expect(orderSummary(at({ requestedDate: today }), today, null).nextStep).toMatch(/« C’est livré » dans l’agenda/);
    const delivered = { status: "livree" as const, deliveredOn: today, requestedDate: today };
    expect(orderSummary(at({ ...delivered, financialStatus: "PENDING" }), today, null).nextStep).toMatch(/Faire la facture/);
    expect(orderSummary(at({ ...delivered, financialStatus: "PENDING" }), today, invoice).nextStep).toMatch(/C’est payé/);
    const paid = orderSummary(at({ ...delivered, financialStatus: "PAID" }), today, invoice);
    expect(paid).toMatchObject({ headline: "Livrée le mercredi 28 octobre", headlineTone: "success", nextStep: "Tout est fait : livrée et payée." });
  });
});
