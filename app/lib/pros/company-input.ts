/**
 * Entrée `companyCreate` d'un compte pro : l'entreprise, son établissement (adresse, TVA, paiement à N jours) et,
 * si la personne n'a pas encore de fiche, son contact. Les valeurs absentes ne sont pas envoyées :
 * une fiche AbaNinja peut n'avoir ni prénom, ni téléphone, ni adresse complète.
 */

export interface ProAccountInput {
  readonly companyName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly street: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly country: string;
  readonly vatNumber: string | null;
}

type Present = Record<string, string>;

function present(values: Readonly<Record<string, string | null>>): Present {
  const kept: Present = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value.trim() !== "") kept[key] = value;
  }
  return kept;
}

function shippingAddress(input: ProAccountInput): Present | null {
  if (input.street === null || input.postalCode === null || input.city === null) return null;
  return present({
    address1: input.street,
    zip: input.postalCode,
    city: input.city,
    countryCode: input.country,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  });
}

export function companyInput(input: ProAccountInput, paymentTermsTemplateId: string | null, withContact: boolean) {
  const address = shippingAddress(input);
  return {
    company: { name: input.companyName, note: "Compte pro créé par l’app BluePoint Gestion." },
    companyLocation: {
      name: input.companyName,
      locale: "fr",
      ...present({ phone: input.phone, taxRegistrationId: input.vatNumber }),
      ...(address === null ? {} : { shippingAddress: address, billingSameAsShipping: true }),
      ...(paymentTermsTemplateId === null
        ? {}
        : { buyerExperienceConfiguration: { paymentTermsTemplateId, checkoutToDraft: false, editableShippingAddress: false } }),
    },
    ...(withContact
      ? { companyContact: { ...present({ email: input.email, firstName: input.firstName, lastName: input.lastName, phone: input.phone }), locale: "fr" } }
      : {}),
  };
}
