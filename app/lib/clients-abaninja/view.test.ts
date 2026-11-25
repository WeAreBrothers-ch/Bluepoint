import { describe, expect, it } from "vitest";
import { compareCards } from "./match";
import { card, client, side, UUID_FAVRE, UUID_LAC, UUID_PARC } from "./test-builders";
import { toComparisonView } from "./view";

const listing = (cards: ReturnType<typeof card>[]) => ({ cards, skipped: 0, truncated: false });

function view(cards: ReturnType<typeof card>[], shopify: ReturnType<typeof side>) {
  return toComparisonView(compareCards(cards, shopify), shopify, listing(cards));
}

describe("toComparisonView", () => {
  it("compte les fiches de chaque groupe et celles qu'un lot peut créer", () => {
    const cards = [
      card(),
      card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["parc@hotel.ch"], phone: null }),
      card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: [], phone: null }),
    ];
    const result = view(cards, side([client({ email: "info@lac.ch" })]));
    expect(result.counts).toEqual({ meme_email: 1, a_verifier: 0, absent: 2, relie: 0, ignore: 0 });
    expect(result.creatable).toBe(1);
  });

  it("ne compte dans le lot que les sociétés : une personne avec e-mail se crée une par une", () => {
    const cards = [card(), card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["luc@favre.ch"], phone: null })];
    const result = view(cards, side([]));
    expect(result.creatable).toBe(1);
    expect(result.groups.absent.find((row) => row.card.uuid === UUID_FAVRE)?.canCreate).toBe(true);
  });

  it("explique qu'un e-mail partagé par plusieurs fiches ne sert pas à créer", () => {
    const cards = [card(), card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["info@lac.ch"] })];
    const row = view(cards, side([])).groups.absent.find((absentRow) => absentRow.card.uuid === UUID_PARC);
    expect(row?.canCreate).toBe(false);
    expect(row?.note).toContain("aussi sur d’autres fiches d’AbaNinja");
    expect(view(cards, side([])).creatable).toBe(0);
  });

  it("dit pourquoi une fiche est mise de côté d'office", () => {
    const cards = [card({ archived: true }), card({ uuid: UUID_PARC, name: "Clients privés", number: "1062" })];
    expect(view(cards, side([])).groups.ignore.map((row) => row.autoReason)).toEqual(["archivee", "prives"]);
  });

  it("écrit les raisons en mots et montre où habite le client", () => {
    const shopify = side([client({ names: ["Restaurant du Lac"], phone: "+41211234567", town: "1095 Lutry" })]);
    const [row] = view([card()], shopify).groups.a_verifier;
    expect(row?.candidates).toEqual([
      { customerId: "gid://shopify/Customer/1", name: "Paul Martin", email: "paul@exemple.ch", place: "1095 Lutry", isPro: false, reasons: ["même nom", "même téléphone"] },
    ]);
  });

  it("décrit la fiche : type, numéro, e-mail, lieu", () => {
    const [row] = view([card({ tags: ["Restaurant"] })], side([])).groups.absent;
    expect(row?.card).toEqual({
      uuid: UUID_LAC,
      name: "Restaurant du Lac Sàrl",
      number: "A0153",
      isCompany: true,
      kindLabel: "Société",
      email: "info@lac.ch",
      place: "1095 Lutry",
      tags: ["Restaurant"],
    });
    expect(row?.canCreate).toBe(true);
    expect(row?.note).toBe("Sera créé en client pro. Aucun e-mail ne lui sera envoyé.");
  });

  it("dit ce qu'une personne recevra d'AbaNinja", () => {
    const person = { uuid: UUID_FAVRE, kind: "person" as const, name: "Luc Favre", emails: ["luc@favre.ch"] };
    expect(view([card({ ...person, phone: null })], side([])).groups.absent[0]?.note).toBe(
      "Sera créé avec son adresse d’AbaNinja. Aucun e-mail ne lui sera envoyé.",
    );
    expect(view([card({ ...person, phone: null, address: null })], side([])).groups.absent[0]?.note).toBe(
      "Sera créé dans la boutique. Aucun e-mail ne lui sera envoyé.",
    );
  });

  it("une fiche sans e-mail ne peut pas être créée et la page dit quoi faire", () => {
    const [row] = view([card({ emails: [] })], side([])).groups.absent;
    expect(row?.canCreate).toBe(false);
    expect(row?.note).toBe("Restaurant du Lac Sàrl n’a pas d’e-mail dans AbaNinja\u202F: ajoutez-le dans AbaNinja, puis rechargez la page.");
  });

  it("dit quel e-mail servira, et pourquoi un e-mail déjà pris bloque la création", () => {
    const parc = card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["pris@x.ch"], phone: null });
    const holder = client({ email: "pris@x.ch", link: { uuid: UUID_PARC, kind: "company", number: null }, proReady: true });
    const both = view([card({ emails: ["pris@x.ch", "libre@x.ch"] }), parc], side([holder]));
    expect(both.groups.absent[0]?.card.email).toBe("libre@x.ch");
    const blocked = view([card({ emails: ["pris@x.ch"] }), parc], side([holder])).groups.absent[0];
    expect(blocked?.canCreate).toBe(false);
    expect(blocked?.note).toBe(
      "L’e-mail de Restaurant du Lac Sàrl est déjà celui de Paul Martin dans la boutique, relié à une autre fiche. Mettez un autre e-mail dans AbaNinja, puis rechargez la page.",
    );
  });

  it("signale un compte pro à terminer parmi les fiches reliées", () => {
    const linked = { uuid: UUID_LAC, kind: "company" as const, number: "A0153" };
    expect(view([card()], side([client({ link: linked })])).groups.relie[0]?.toFinish).toBe(true);
    expect(view([card()], side([client({ link: linked, proReady: true })])).groups.relie[0]?.toFinish).toBe(false);
    const person = card({ kind: "person", name: "Luc Favre" });
    expect(view([person], side([client({ link: { ...linked, kind: "person" } })])).groups.relie[0]?.toFinish).toBe(false);
  });

  it("dit qu'une fiche est mise de côté d'office ou à la main", () => {
    const cards = [card({ number: "1062", name: "Clients privés" }), card({ uuid: UUID_PARC, name: "Fournisseur" })];
    const rows = view(cards, side([], [UUID_PARC])).groups.ignore;
    expect(rows.map((row) => row.autoReason)).toEqual(["prives", null]);
  });

  it("montre à qui une fiche déjà reliée correspond", () => {
    const shopify = side([client({ link: { uuid: UUID_LAC, kind: "company", number: "A0153" } })]);
    expect(view([card()], shopify).groups.relie).toEqual([
      expect.objectContaining({ client: { customerId: "gid://shopify/Customer/1", name: "Paul Martin", email: "paul@exemple.ch", place: "1003 Lausanne", isPro: false, reasons: [] } }),
    ]);
  });
});
