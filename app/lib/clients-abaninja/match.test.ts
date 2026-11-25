import { describe, expect, it } from "vitest";
import { compareCards, findStatus } from "./match";
import { card, client, side, UUID_FAVRE, UUID_LAC, UUID_PARC } from "./test-builders";

const LINK_LAC = { uuid: UUID_LAC, kind: "company" as const, number: "A0153" };

function statusOf(cards: Parameters<typeof compareCards>[0], shopify: Parameters<typeof compareCards>[1], uuid = UUID_LAC) {
  return findStatus(compareCards(cards, shopify), uuid);
}

describe("compareCards : fiches déjà reliées ou ignorées", () => {
  it("voit le lien posé sur le client", () => {
    const linked = client({ link: LINK_LAC });
    expect(statusOf([card()], side([linked]))).toMatchObject({ kind: "relie", client: linked });
  });

  it("voit le lien posé sur l'entreprise du client", () => {
    const linked = client({ companyLink: LINK_LAC });
    expect(statusOf([card()], side([linked]))).toMatchObject({ kind: "relie", client: linked });
  });

  it("ignore d'office la fiche « Clients privés »", () => {
    expect(statusOf([card({ name: "Clients privés", number: "1062" })], side([]))).toMatchObject({ kind: "ignore", auto: true });
  });

  it("met d'office de côté une fiche archivée dans AbaNinja", () => {
    expect(statusOf([card({ archived: true })], side([]))).toMatchObject({ kind: "ignore", auto: true });
  });

  it("garde reliée une fiche archivée après coup", () => {
    const linked = client({ link: LINK_LAC });
    expect(statusOf([card({ archived: true })], side([linked]))).toMatchObject({ kind: "relie" });
  });

  it("ignore une fiche mise de côté", () => {
    expect(statusOf([card()], side([], [UUID_LAC]))).toMatchObject({ kind: "ignore", auto: false });
  });
});

describe("compareCards : rapprochement", () => {
  it("propose de relier le seul client qui a un e-mail de la fiche", () => {
    const same = client({ email: "info@lac.ch" });
    expect(statusOf([card()], side([same]))).toMatchObject({ kind: "meme_email", candidate: { client: same, reasons: ["email"] } });
  });

  it("ne propose jamais le même client pour deux fiches : les deux sont à vérifier", () => {
    const shared = client({ email: "info@lac.ch" });
    const statuses = compareCards([card(), card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["info@lac.ch"] })], side([shared]));
    expect(findStatus(statuses, UUID_LAC)?.kind).toBe("a_verifier");
    expect(findStatus(statuses, UUID_PARC)?.kind).toBe("a_verifier");
  });

  it("demande de vérifier un client au nom proche", () => {
    const similar = client({ names: ["Restaurant du Lac"], email: "marie.rochat@gmail.com" });
    expect(statusOf([card()], side([similar]))).toMatchObject({ kind: "a_verifier", candidates: [{ client: similar, reasons: ["nom"] }] });
  });

  it("reconnaît la personne de contact d'une société", () => {
    const contact = client({ names: ["Marie Rochat"], email: "marie.rochat@gmail.com" });
    expect(statusOf([card()], side([contact]))).toMatchObject({ kind: "a_verifier", candidates: [{ reasons: ["nom"] }] });
  });

  it("demande de vérifier un client au même téléphone", () => {
    const samePhone = client({ phone: "+41211234567" });
    expect(statusOf([card()], side([samePhone]))).toMatchObject({ kind: "a_verifier", candidates: [{ reasons: ["telephone"] }] });
  });

  it("classe les candidats par nombre de ressemblances et en garde trois", () => {
    const strong = client({ customerId: "gid://shopify/Customer/9", names: ["Restaurant du Lac"], phone: "+41211234567" });
    const others = [2, 3, 4].map((n) => client({ customerId: `gid://shopify/Customer/${n}`, names: ["Restaurant du Lac"] }));
    const status = statusOf([card()], side([...others, strong]));
    expect(status?.kind === "a_verifier" && status.candidates.map((candidate) => candidate.client.customerId)).toEqual([
      "gid://shopify/Customer/9",
      "gid://shopify/Customer/2",
      "gid://shopify/Customer/3",
    ]);
  });
});

describe("compareCards : fiches absentes de la boutique", () => {
  it("ne propose plus un client refusé ; la fiche est à créer avec son e-mail libre", () => {
    const refused = client({ names: ["Restaurant du Lac"], refused: [UUID_LAC] });
    expect(statusOf([card()], side([refused]))).toMatchObject({ kind: "absent", email: "info@lac.ch", blockedBy: null });
  });

  it("ne propose jamais un client déjà relié à une autre fiche", () => {
    const elsewhere = client({ email: "info@lac.ch", link: { uuid: UUID_PARC, kind: "company", number: null } });
    expect(statusOf([card()], side([elsewhere]))?.kind).toBe("absent");
  });

  it("bloque la création quand tous les e-mails de la fiche sont déjà pris", () => {
    const holder = client({ displayName: "Paul Martin", email: "info@lac.ch", refused: [UUID_LAC] });
    expect(statusOf([card()], side([holder]))).toMatchObject({ kind: "absent", email: null, blockedBy: "Paul Martin" });
  });

  it("prend le premier e-mail libre de la fiche", () => {
    const holder = client({ email: "info@lac.ch", refused: [UUID_LAC] });
    const status = statusOf([card({ emails: ["info@lac.ch", "compta@lac.ch"] })], side([holder]));
    expect(status).toMatchObject({ kind: "absent", email: "compta@lac.ch", blockedBy: null });
  });

  it("n'utilise pas un téléphone déjà porté par un autre client", () => {
    const holder = client({ phone: "+41211234567", link: { uuid: UUID_PARC, kind: "company", number: null } });
    expect(statusOf([card()], side([holder]))).toMatchObject({ kind: "absent", phone: null });
  });

  it("ne crée pas avec un e-mail porté par plusieurs sociétés : il ne désigne aucun client précis", () => {
    const cards = [card(), card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["info@lac.ch"] })];
    const statuses = compareCards(cards, side([]));
    for (const uuid of [UUID_LAC, UUID_PARC]) {
      expect(findStatus(statuses, uuid)).toMatchObject({ kind: "absent", email: null, blockedBy: null, sharedEmail: true });
    }
  });

  it("prend alors un autre e-mail de la fiche, s'il lui est propre", () => {
    const cards = [card({ emails: ["patron@gmail.com", "info@lac.ch"] }), card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["patron@gmail.com"] })];
    expect(findStatus(compareCards(cards, side([])), UUID_LAC)).toMatchObject({ kind: "absent", email: "info@lac.ch", sharedEmail: false });
  });

  it("garde l'e-mail d'une société qu'une personne (son contact) porte aussi", () => {
    const cards = [card(), card({ uuid: UUID_FAVRE, kind: "person", name: "Marie Rochat", emails: ["info@lac.ch"] })];
    expect(findStatus(compareCards(cards, side([])), UUID_LAC)).toMatchObject({ kind: "absent", email: "info@lac.ch" });
  });

  it("ne crée pas non plus une personne avec un e-mail porté par plusieurs personnes", () => {
    const cards = [card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["patron@gmail.com"] }), card({ uuid: UUID_PARC, kind: "person", name: "Ana Roy", emails: ["patron@gmail.com"] })];
    expect(findStatus(compareCards(cards, side([])), UUID_FAVRE)).toMatchObject({ kind: "absent", email: null, sharedEmail: true });
  });

  it("laisse une fiche sans e-mail à compléter dans AbaNinja", () => {
    expect(statusOf([card({ uuid: UUID_FAVRE, kind: "person", emails: [] })], side([]), UUID_FAVRE)).toMatchObject({
      kind: "absent",
      email: null,
      blockedBy: null,
    });
  });
});
