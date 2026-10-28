import { describe, expect, it } from "vitest";
import { EMPTY_PRO_REQUEST } from "./request";
import { escapeForLiquid, proFormPage, proThanksPage } from "./storefront-form";

describe("page « Devenir client pro » du site", () => {
  it("échappe le HTML et le Liquid tapés par un visiteur", () => {
    expect(escapeForLiquid(`<b>"{{ shop.secret }}"</b> {% if %}`)).toBe(
      "&lt;b&gt;&quot;&#123;&#123; shop.secret &#125;&#125;&quot;&lt;/b&gt; &#123;&#37; if &#37;&#125;",
    );
    const page = proFormPage({ ...EMPTY_PRO_REQUEST, companyName: "{{ customer.email }}" }, {}, false);
    expect(page).not.toContain("{{ customer.email }}");
  });

  it("préremplit le client connecté au premier affichage seulement", () => {
    expect(proFormPage(EMPTY_PRO_REQUEST, {}, true)).toContain("{% if customer %}{{ customer.email | escape }}{% endif %}");
    const retyped = proFormPage({ ...EMPTY_PRO_REQUEST, email: "a@b.ch" }, {}, false);
    expect(retyped).toContain('value="a@b.ch"');
    expect(retyped).not.toContain("customer.email");
  });

  it("signale les champs à corriger", () => {
    const page = proFormPage(EMPTY_PRO_REQUEST, { phone: "Numéro de téléphone invalide." }, false);
    expect(page).toContain("Certaines informations sont à corriger");
    expect(page).toContain('aria-invalid="true"');
    expect(page).toContain("Numéro de téléphone invalide.");
  });

  it("remercie en nommant la boutique", () => {
    expect(proThanksPage()).toContain("{{ shop.name }}");
  });
});
