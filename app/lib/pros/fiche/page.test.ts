import { describe, expect, it } from "vitest";
import { EMPTY_FICHE } from "./form";
import { FICHE_ACTION, ficheDonePage, ficheFormPage, ficheLoginPage, ficheNotProPage, ficheUnavailablePage } from "./page";

const VIEW = { companyName: "Café de Grancy", locationId: "gid://shopify/CompanyLocation/10", parts: ["phone", "address"] } as const;

describe("page « Compléter ma fiche pro » du site", () => {
  it("dit ce qui manque et ne montre que ces champs", () => {
    const page = ficheFormPage(VIEW, EMPTY_FICHE, {});
    expect(page).toContain("Café de Grancy");
    expect(page).toContain("Il nous manque votre numéro de téléphone et l’adresse de livraison.");
    expect(page).toContain('name="phone"');
    expect(page).toContain('name="postalCode"');
    expect(page).not.toContain('name="firstName"');
    expect(page).toContain(`action="${FICHE_ACTION}"`);
    expect(page).toContain('<input type="hidden" name="lieu" value="10">');
  });

  it("relie chaque champ à son libellé et à son erreur", () => {
    const page = ficheFormPage(VIEW, { ...EMPTY_FICHE, phone: "12" }, { phone: "Numéro de téléphone invalide." });
    expect(page).toContain('<label for="bp-fiche-phone" class="bp-ui">');
    expect(page).toContain('aria-invalid="true" aria-describedby="bp-fiche-phone-err"');
    expect(page).toContain('id="bp-fiche-phone-err"');
    expect(page).toContain('value="12"');
    expect(page).toContain("à corriger");
  });

  it("échappe le HTML et le Liquid tapés par le client et le nom de l'entreprise", () => {
    const page = ficheFormPage({ ...VIEW, companyName: "<b>{{ shop.email }}</b>" }, { ...EMPTY_FICHE, city: "{% if %}" }, {});
    expect(page).not.toContain("{{ shop.email }}");
    expect(page).not.toContain("{% if %}");
    expect(page).not.toContain("<b>");
  });

  it("garde le pays choisi", () => {
    const page = ficheFormPage(VIEW, { ...EMPTY_FICHE, country: "LI" }, {});
    expect(page).toContain('<option value="LI" selected>');
  });

  it("remercie après l'envoi, et ramène à l'Espace pro", () => {
    expect(ficheDonePage("ZELIG", true)).toContain("Merci, votre fiche pro est complète");
    expect(ficheDonePage("ZELIG", false)).toContain("Votre fiche pro est complète");
    expect(ficheDonePage("ZELIG", false)).toContain('href="/pages/espace-pro"');
  });

  it("propose de se connecter, puis revient sur cette page", () => {
    expect(ficheLoginPage()).toContain('href="/customer_authentication/login?return_to=%2Fapps%2Fbon-commande%2Fma-fiche"');
  });

  it("explique les cas où la fiche ne peut pas être complétée", () => {
    expect(ficheNotProPage()).toContain("pas encore rattaché à une entreprise");
    expect(ficheUnavailablePage()).toContain("Réessayez dans quelques minutes");
  });
});
