/**
 * Traduit un refus de Shopify (`userErrors`, souvent en anglais) en une phrase simple qui dit quoi faire.
 * Le texte brut n'est jamais montré : il reste dans les journaux pour l'assistance.
 * Renvoie null quand le refus n'est pas reconnu (l'appelant garde alors son message général).
 */

const RULES: readonly { readonly pattern: RegExp; readonly text: string }[] = [
  {
    pattern: /(phone|e-?mail).*(already been taken|already exists)|has already been taken/i,
    text: "Ce numéro ou cet e-mail appartient déjà à un client. Cherchez-le plutôt par son nom ou son numéro de téléphone.",
  },
  {
    pattern: /inventory|out of stock|stock insuffisant|not enough|insufficient/i,
    text: "Un des vins n’a plus assez de bouteilles. Corrigez leur nombre dans « Stock », ou baissez la quantité.",
  },
  {
    pattern: /variant.*(does not exist|not found|deleted|unavailable|not available)|product.*(not available|unavailable|archived)/i,
    text: "Un des vins n’est plus en vente. Rechargez la page et choisissez-le à nouveau.",
  },
  {
    pattern: /customer.*(does not exist|not found|deleted)|purchasing entity|company location/i,
    text: "Ce client n’existe plus ou a changé. Rechargez la page et choisissez-le à nouveau.",
  },
  {
    pattern: /(zip|postal|province|country|address).*(invalid|blank|required|not valid)/i,
    text: "L’adresse du client est incomplète. Complétez-la (nom, rue et numéro, NPA, localité), puis réessayez.",
  },
  {
    pattern: /e-?mail.*(invalid|not valid)|phone.*(invalid|not valid)/i,
    text: "L’e-mail ou le téléphone du client n’est pas valable. Corrigez-le dans « Clients » (bouton « Modifier les coordonnées »).",
  },
  {
    pattern: /\bon hold\b|\bheld\b/i,
    text: "Cette commande est en attente. Demandez à la personne qui s’occupe de la boutique de la débloquer, puis réessayez.",
  },
  {
    pattern: /(already|has been) (fulfilled|paid|completed|closed)|cannot be marked as paid/i,
    text: "C’était déjà fait. Rechargez la page pour voir la situation à jour.",
  },
  {
    pattern: /\bcancell?ed\b/i,
    text: "Cette commande a été annulée.",
  },
  {
    pattern: /access denied|not authorized|permission|scope/i,
    text: "L’application n’a pas le droit de faire cela. Contactez la personne qui l’a installée.",
  },
];

export function plainShopifyRefusal(detail: string): string | null {
  return RULES.find((rule) => rule.pattern.test(detail))?.text ?? null;
}
