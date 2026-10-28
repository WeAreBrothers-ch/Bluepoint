import { describe, expect, it } from "vitest";
import { addressText, directionsUrl, phoneDisplay, phoneHref } from "./contact";

const place = { street: "Quai Fictif 12", zip: "1095", city: "Lutry" };

describe("contact d'une livraison", () => {
  it("écrit l'adresse et l'itinéraire", () => {
    expect(addressText(place)).toBe("Quai Fictif 12, 1095 Lutry");
    expect(addressText({ street: null, zip: null, city: "Lutry" })).toBe("Lutry");
    expect(addressText({ street: null, zip: null, city: null })).toBeNull();
    expect(directionsUrl(place)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Quai%20Fictif%2012%2C%201095%20Lutry%2C%20Suisse",
    );
  });

  it("appelle un numéro suisse et l'affiche à la suisse", () => {
    expect(phoneHref("021 555 01 23")).toBe("tel:+41215550123");
    expect(phoneHref("pas un numéro")).toBeNull();
    expect(phoneDisplay("+41791234567")).toBe("079 123 45 67");
    expect(phoneDisplay("+33612345678")).toBe("+33612345678");
  });
});
