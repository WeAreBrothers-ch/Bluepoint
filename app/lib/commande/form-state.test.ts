import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { customerNode, VARIANT_A } from "./fixtures";
import { toCustomerOption } from "./customers";
import { defaultPayment, formReducer, initialFormState, toPriceRequest, toSubmission } from "./form-state";

const TODAY = "2026-10-21" as IsoDate;

describe("formulaire de commande", () => {
  it("propose demain, sans date limite, paiement sur facture", () => {
    const state = initialFormState(TODAY);
    expect(state.requestedDate).toBe("2026-10-22");
    expect(state.deadline).toBe("2026-10-22");
    expect(state.deadlineShown).toBe(false);
    expect(state.payment).toBe("facture");
  });

  it("ne propose jamais une livraison le dimanche", () => {
    expect(initialFormState("2026-10-24" as IsoDate).requestedDate).toBe("2026-10-26");
  });

  it("propose « sur facture » à un pro et « à la livraison » à un particulier", () => {
    const pro = toCustomerOption(customerNode({ tags: ["pro"] }));
    const particulier = toCustomerOption(customerNode());
    expect(defaultPayment(pro)).toBe("facture");
    expect(defaultPayment(particulier)).toBe("a_la_livraison");
    expect(formReducer(initialFormState(TODAY), { type: "client", customer: particulier }).payment).toBe("a_la_livraison");
  });

  it("reprend les vins d'une commande précédente et remet la date limite au jour de livraison", () => {
    let state = formReducer(initialFormState(TODAY), { type: "ajouter", variantId: VARIANT_A, delta: 1 });
    state = formReducer(state, { type: "reprendre", lines: [{ variantId: VARIANT_A, quantity: 12 }] });
    expect(state.quantities).toEqual({ [VARIANT_A]: 12 });
    state = formReducer(state, { type: "limite_visible", shown: true });
    state = formReducer(state, { type: "date_limite", value: "2026-10-30" });
    state = formReducer(state, { type: "limite_visible", shown: false });
    expect(state.deadline).toBe(state.requestedDate);
  });

  it("la date limite suit la date souhaitée tant qu'elle n'est pas modifiée", () => {
    let state = formReducer(initialFormState(TODAY), { type: "date_souhaitee", value: "2026-10-28" });
    expect(state.deadline).toBe("2026-10-28");
    state = formReducer(state, { type: "date_limite", value: "2026-10-30" });
    state = formReducer(state, { type: "date_souhaitee", value: "2026-10-29" });
    expect(state.deadline).toBe("2026-10-30");
    state = formReducer(state, { type: "date_souhaitee", value: "2026-11-02" });
    expect(state.deadline).toBe("2026-11-02");
  });

  it("choisit par défaut le premier site B2B du client", () => {
    const profile = {
      id: "gid://shopify/CompanyContact/2",
      company: { id: "gid://shopify/Company/1", name: "La Poésia SA" },
      roleAssignments: { nodes: [{ companyLocation: { id: "gid://shopify/CompanyLocation/3", name: "Lutry" } }] },
    };
    const customer = toCustomerOption(customerNode({ companyContactProfiles: [profile] }));
    let state = formReducer(initialFormState(TODAY), { type: "client", customer });
    state = formReducer(state, { type: "ajouter", variantId: VARIANT_A, delta: 6 });
    expect(toSubmission(state, "k").b2b?.companyLocationId).toBe("gid://shopify/CompanyLocation/3");
    expect(toPriceRequest(state)?.lines).toEqual([{ variantId: VARIANT_A, quantity: 6 }]);

    state = formReducer(state, { type: "b2b", locationId: null });
    expect(toSubmission(state, "k").b2b).toBeNull();
    expect(toPriceRequest(state)?.b2b).toBeNull();
  });

  it("vide tout après une commande", () => {
    const filled = formReducer(initialFormState(TODAY), { type: "note", value: "x" });
    expect(formReducer(filled, { type: "vider", today: TODAY })).toEqual(initialFormState(TODAY));
  });
});
