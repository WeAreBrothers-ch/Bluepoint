import { HONEYPOT_FIELD, PRO_COUNTRIES, type ProRequestErrors, type ProRequestField, type ProRequestValues } from "./request";

/**
 * Page « Devenir client pro » du site, servie par le proxy d'app en Liquid : Shopify l'affiche
 * dans le thème de la boutique (en-tête, menu, pied de page). Logique pure, testée.
 *
 * Tout texte saisi par un visiteur est échappé, accolades comprises : sinon il pourrait
 * glisser du Liquid ({{ … }}, {% … %}) que Shopify exécuterait.
 */

export const PRO_FORM_ACTION = "/apps/bon-commande/devenir-pro";

export function escapeForLiquid(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;")
    .replaceAll("%", "&#37;");
}

const STYLE = `<style>
.bp-pro{max-width:40rem;margin:2rem auto;padding:0 1rem;font-size:1.0625rem;line-height:1.5}
.bp-pro h1{margin:0 0 .75rem}
.bp-pro fieldset{border:0;padding:0;margin:0 0 1.5rem}
.bp-pro legend{font-weight:700;font-size:1.125rem;margin-bottom:.5rem}
.bp-pro label{display:block;font-weight:600;margin:.75rem 0 .25rem}
.bp-pro input,.bp-pro select,.bp-pro textarea{width:100%;box-sizing:border-box;padding:.7rem .8rem;font-size:1rem;border:1px solid #8a8a8a;border-radius:.4rem;background:#fff;color:#1a1a1a}
.bp-pro .bp-help{font-size:.9rem;color:#5c5c5c;margin:.25rem 0 0}
.bp-pro .bp-error{color:#b42318;font-weight:600;margin:.25rem 0 0}
.bp-pro .bp-invalid{border-color:#b42318;border-width:2px}
.bp-pro .bp-alert{border:2px solid #b42318;border-radius:.5rem;padding:.75rem 1rem;margin:0 0 1.5rem;color:#b42318;font-weight:600}
.bp-pro .bp-ok{border:2px solid #1a7f37;border-radius:.5rem;padding:1rem 1.25rem;margin:0 0 1.5rem}
.bp-pro .bp-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.bp-pro button,.bp-pro .bp-button{display:inline-block;padding:.9rem 1.5rem;font-size:1.0625rem;font-weight:700;border:0;border-radius:.5rem;background:#1a1a1a;color:#fff;cursor:pointer;text-decoration:none}
</style>`;

interface FieldSpec {
  readonly field: ProRequestField;
  readonly label: string;
  readonly type?: "text" | "email" | "tel";
  readonly autocomplete: string;
  readonly help?: string;
  /** Valeur Liquid du client connecté, posée seulement au premier affichage. */
  readonly customerValue?: string;
}

function input(spec: FieldSpec, values: ProRequestValues, errors: ProRequestErrors, prefill: boolean): string {
  const error = errors[spec.field];
  const typed = values[spec.field];
  const value = prefill && typed === "" && spec.customerValue !== undefined ? `{% if customer %}{{ ${spec.customerValue} | escape }}{% endif %}` : escapeForLiquid(typed);
  const id = `bp-${spec.field}`;
  return [
    `<label for="${id}">${spec.label}</label>`,
    `<input id="${id}" name="${spec.field}" type="${spec.type ?? "text"}" autocomplete="${spec.autocomplete}" value="${value}"${error === undefined ? "" : ` class="bp-invalid" aria-invalid="true" aria-describedby="${id}-err"`}>`,
    spec.help === undefined ? "" : `<p class="bp-help">${spec.help}</p>`,
    error === undefined ? "" : `<p class="bp-error" id="${id}-err">${escapeForLiquid(error)}</p>`,
  ].join("");
}

function countrySelect(values: ProRequestValues): string {
  const options = PRO_COUNTRIES.map(
    (country) => `<option value="${country.code}"${values.country === country.code ? " selected" : ""}>${country.label}</option>`,
  ).join("");
  return `<label for="bp-country">Pays</label><select id="bp-country" name="country" autocomplete="country">${options}</select>`;
}

export function proFormPage(values: ProRequestValues, errors: ProRequestErrors, prefill: boolean): string {
  const field = (spec: FieldSpec) => input(spec, values, errors, prefill);
  const hasErrors = Object.keys(errors).length > 0;
  return `${STYLE}
<div class="bp-pro">
<h1>Devenir client pro</h1>
<p>Restaurants, bars, cavistes et entreprises : demandez votre compte pro. Une fois votre demande acceptée, vous voyez vos prix pros et pouvez commander sur facture, payable à 30 jours.</p>
${hasErrors ? `<p class="bp-alert" role="alert">Certaines informations sont à corriger : elles sont signalées en rouge ci-dessous.</p>` : ""}
<form method="post" action="${PRO_FORM_ACTION}" novalidate>
<fieldset><legend>Votre entreprise</legend>
${field({ field: "companyName", label: "Nom de l’entreprise", autocomplete: "organization" })}
${field({ field: "vatNumber", label: "Numéro TVA (facultatif)", autocomplete: "off", help: "Exemple : CHE-123.456.789 TVA" })}
</fieldset>
<fieldset><legend>Vous</legend>
${field({ field: "firstName", label: "Prénom", autocomplete: "given-name", customerValue: "customer.first_name" })}
${field({ field: "lastName", label: "Nom", autocomplete: "family-name", customerValue: "customer.last_name" })}
${field({ field: "email", label: "E-mail", type: "email", autocomplete: "email", help: "Vous vous connecterez au site avec cette adresse.", customerValue: "customer.email" })}
${field({ field: "phone", label: "Téléphone", type: "tel", autocomplete: "tel", help: "Exemple : 079 123 45 67" })}
</fieldset>
<fieldset><legend>Adresse de livraison</legend>
${field({ field: "street", label: "Rue et numéro", autocomplete: "address-line1" })}
${field({ field: "postalCode", label: "NPA", autocomplete: "postal-code" })}
${field({ field: "city", label: "Localité", autocomplete: "address-level2" })}
${countrySelect(values)}
</fieldset>
<fieldset><legend>Un message ? (facultatif)</legend>
<label for="bp-message">Votre message</label>
<textarea id="bp-message" name="message" rows="3">${escapeForLiquid(values.message)}</textarea>
${errors.message === undefined ? "" : `<p class="bp-error">${escapeForLiquid(errors.message)}</p>`}
</fieldset>
<div class="bp-trap" aria-hidden="true"><label for="bp-trap">Ne pas remplir</label><input id="bp-trap" name="${HONEYPOT_FIELD}" tabindex="-1" autocomplete="off" value=""></div>
<button type="submit">Envoyer ma demande</button>
</form>
<p class="bp-help">Nous vérifions chaque demande. Vous recevrez un e-mail dès que votre compte pro est prêt.</p>
</div>`;
}

export function proThanksPage(): string {
  return `${STYLE}
<div class="bp-pro">
<div class="bp-ok" role="status">
<h1>Merci, votre demande est bien arrivée</h1>
<p>Nous la vérifions. Dès que votre compte pro est prêt, vous recevrez un e-mail de {{ shop.name }} pour vous connecter et voir vos prix pros.</p>
</div>
<a class="bp-button" href="/">Retour à la boutique</a>
</div>`;
}

export function proUnavailablePage(): string {
  return `${STYLE}
<div class="bp-pro">
<h1>Demande impossible pour le moment</h1>
<p>Votre demande n’a pas pu être enregistrée. Réessayez un peu plus tard, ou appelez-nous : nous ouvrirons votre compte pro par téléphone.</p>
<a class="bp-button" href="/">Retour à la boutique</a>
</div>`;
}
