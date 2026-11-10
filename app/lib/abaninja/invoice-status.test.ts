import { describe, expect, it } from "vitest";
import { interpretInvoiceStatus, todayInZurich, type InvoiceReadState } from "./invoice-status";

const TODAY = "2026-11-10";
const FUTURE = "2026-12-10";
const PAST = "2026-10-01";

const EXPECTED: Readonly<Record<string, InvoiceReadState>> = {
  draft: "brouillon",
  open: "envoyee",
  sending: "envoyee",
  "send-failed": "inconnu",
  sent: "envoyee",
  viewed: "envoyee",
  approved: "inconnu",
  declined: "inconnu",
  partial: "partiellement_payee",
  paid: "payee",
  "in-payment": "envoyee",
  collected: "inconnu",
  planned: "inconnu",
  pending: "inconnu",
  archived: "inconnu",
  cancelled: "annulee",
  converted: "inconnu",
  due: "en_retard",
  reminder: "en_retard",
  "first-dunning": "en_retard",
  "second-dunning": "en_retard",
  "final-dunning": "en_retard",
  inactive: "inconnu",
  active: "inconnu",
  inbox: "inconnu",
  expired: "inconnu",
  done: "inconnu",
  assign: "inconnu",
  "awaiting-payment": "envoyee",
  error: "inconnu",
};

describe("interpretInvoiceStatus", () => {
  it.each(Object.entries(EXPECTED))("statut %s -> %s", (status, expected) => {
    expect(interpretInvoiceStatus({ status, openAmount: 100, dueDate: FUTURE }, TODAY)).toBe(expected);
  });

  it("une valeur inconnue ne donne jamais « payée », même avec un solde nul", () => {
    expect(interpretInvoiceStatus({ status: "nouveau-statut", openAmount: 0, dueDate: PAST }, TODAY)).toBe("inconnu");
    expect(interpretInvoiceStatus({ status: "", openAmount: 0, dueDate: null }, TODAY)).toBe("inconnu");
  });

  it("calcule le retard d'une facture émise dont l'échéance est passée et le solde positif", () => {
    expect(interpretInvoiceStatus({ status: "sent", openAmount: 50, dueDate: PAST }, TODAY)).toBe("en_retard");
  });

  it("pas de retard le jour de l'échéance, ni sans solde, ni sans date lisible", () => {
    expect(interpretInvoiceStatus({ status: "sent", openAmount: 50, dueDate: TODAY }, TODAY)).toBe("envoyee");
    expect(interpretInvoiceStatus({ status: "sent", openAmount: 0, dueDate: PAST }, TODAY)).toBe("envoyee");
    expect(interpretInvoiceStatus({ status: "sent", openAmount: null, dueDate: PAST }, TODAY)).toBe("envoyee");
    expect(interpretInvoiceStatus({ status: "sent", openAmount: 50, dueDate: "bientôt" }, TODAY)).toBe("envoyee");
  });

  it("accepte une échéance au format date-heure", () => {
    expect(interpretInvoiceStatus({ status: "open", openAmount: 5, dueDate: "2026-10-01T00:00:00+02:00" }, TODAY)).toBe(
      "en_retard",
    );
  });

  it("isCancelled l'emporte sur le statut", () => {
    expect(interpretInvoiceStatus({ status: "paid", openAmount: 0, dueDate: null, isCancelled: true }, TODAY)).toBe(
      "annulee",
    );
  });

  it("une facture payée reste payée même échue", () => {
    expect(interpretInvoiceStatus({ status: "paid", openAmount: 0, dueDate: PAST }, TODAY)).toBe("payee");
  });
});

describe("todayInZurich", () => {
  it("donne la date du calendrier suisse (minuit passé à Zurich)", () => {
    expect(todayInZurich(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10");
  });
});

describe("todayInZurich : format", () => {
  it("donne toujours AAAA-MM-JJ avec zéros, en heure d'hiver et d'été", () => {
    expect(todayInZurich(new Date("2026-01-05T10:00:00Z"))).toBe("2026-01-05");
    expect(todayInZurich(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01");
  });
});
