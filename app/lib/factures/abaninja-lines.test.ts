import { describe, expect, it } from "vitest";
import { isProTestBuyer } from "./abaninja-lines";

/** Une commande fictive d'un pro (client marqué « pro ») : ses pièces vont au client pro fictif d'AbaNinja. */

function source(customerTags: readonly string[] | undefined, hasCustomer = true) {
  const customer = hasCustomer ? { defaultEmailAddress: null, defaultPhoneNumber: null, ...(customerTags === undefined ? {} : { tags: customerTags }) } : null;
  return { contact: { customer } };
}

describe("client pro d'une commande fictive", () => {
  it("reconnaît un client marqué « pro », même écrit autrement", () => {
    expect(isProTestBuyer(source(["fictif", "pro"]))).toBe(true);
    expect(isProTestBuyer(source([" Pro "]))).toBe(true);
  });

  it("un particulier, une commande sans client ou sans étiquettes lues : pas un pro", () => {
    expect(isProTestBuyer(source(["fictif"]))).toBe(false);
    expect(isProTestBuyer(source(["professionnel"]))).toBe(false);
    expect(isProTestBuyer(source(undefined))).toBe(false);
    expect(isProTestBuyer(source([], false))).toBe(false);
  });
});
