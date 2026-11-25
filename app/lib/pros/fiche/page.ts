import { PRO_COUNTRIES } from "../request";
import { escapeForLiquid, ONE_SUBMIT } from "../storefront-form";
import { fieldsFor, type FicheErrors, type FicheField, type FicheValues } from "./form";
import { describeMissing, numericId, type FichePart } from "./state";

/**
 * Page « Compléter ma fiche pro » du site, servie en Liquid par le proxy d'app : Shopify l'affiche dans le thème
 * (en-tête, pied de page). Elle reprend le cadre et les champs de l'Espace pro (`bp-pro-portal.css` du thème).
 * Tout texte venu du client ou de Shopify est échappé, accolades comprises (voir `escapeForLiquid`).
 */

export const FICHE_ACTION = "/apps/bon-commande/ma-fiche";
const PRO_PAGE = "/pages/espace-pro";
const LOGIN_URL = `/customer_authentication/login?return_to=${encodeURIComponent(FICHE_ACTION)}`;

const STYLE = `{{ 'bp-pro-portal.css' | asset_url | stylesheet_tag }}
<style>
.bp-fiche{display:grid;justify-items:start;gap:clamp(1.25rem,3vw,2rem);padding:calc(var(--hauteur-entete) + clamp(2rem,5vw,3.5rem)) var(--marge) var(--section)}
.bp-fiche .bp-pro__panel{width:100%}
.bp-fiche fieldset{display:grid;gap:1rem;margin:0;padding:0;border:0}
.bp-fiche legend{margin-block-end:.75rem;font-size:var(--t-sous-titre);font-weight:800}
.bp-fiche select{width:100%;min-height:3.25rem;padding:.75rem 1.25rem;border:var(--trait) solid var(--encre);border-radius:var(--rayon-pilule);background:var(--c-blanc);color:var(--encre);font:inherit;font-size:1rem}
.bp-fiche select:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.bp-fiche [aria-invalid="true"]{border-width:3px}
.bp-fiche__help,.bp-fiche__err{font-size:var(--t-ui)}
.bp-fiche__help{color:var(--encre-douce)}
.bp-fiche__err{font-weight:700}
.bp-fiche button[disabled]{opacity:.7;cursor:progress}
</style>`;

interface FieldSpec {
  readonly label: string;
  readonly type?: "text" | "tel";
  readonly autocomplete: string;
  readonly help?: string;
}

const SPECS: Readonly<Record<Exclude<FicheField, "country">, FieldSpec>> = {
  firstName: { label: "Prénom", autocomplete: "given-name" },
  lastName: { label: "Nom", autocomplete: "family-name" },
  phone: { label: "Téléphone", type: "tel", autocomplete: "tel", help: "Le numéro où vous joindre pour une commande ou une livraison. Exemple\u202F: 079 123 45 67" },
  street: { label: "Rue et numéro", autocomplete: "address-line1" },
  postalCode: { label: "NPA", autocomplete: "postal-code" },
  city: { label: "Localité", autocomplete: "address-level2" },
};

function field(name: FicheField, values: FicheValues, errors: FicheErrors): string {
  const id = `bp-fiche-${name}`;
  const error = errors[name];
  const invalid = error === undefined ? "" : ` aria-invalid="true" aria-describedby="${id}-err"`;
  const errorLine = error === undefined ? "" : `<span class="bp-fiche__err" id="${id}-err">${escapeForLiquid(error)}</span>`;
  if (name === "country") {
    const options = PRO_COUNTRIES.map((country) => `<option value="${country.code}"${values.country === country.code ? " selected" : ""}>${country.label}</option>`).join("");
    return `<div class="bp-pro__field"><label for="${id}" class="bp-ui">Pays</label><select id="${id}" name="country" autocomplete="country"${invalid}>${options}</select>${errorLine}</div>`;
  }
  const spec = SPECS[name];
  const help = spec.help === undefined ? "" : `<span class="bp-fiche__help">${spec.help}</span>`;
  return `<div class="bp-pro__field"><label for="${id}" class="bp-ui">${spec.label}</label><input id="${id}" name="${name}" type="${spec.type ?? "text"}" autocomplete="${spec.autocomplete}" value="${escapeForLiquid(values[name])}"${invalid}>${help}${errorLine}</div>`;
}

function group(legend: string, names: readonly FicheField[], values: FicheValues, errors: FicheErrors): string {
  return names.length === 0 ? "" : `<fieldset><legend>${legend}</legend>${names.map((name) => field(name, values, errors)).join("")}</fieldset>`;
}

function frame(title: string, body: string): string {
  return `${STYLE}
<section class="bp-fiche" aria-labelledby="bp-fiche-titre">
<p class="bp-ui bp-pro__label">Espace pro</p>
<h1 id="bp-fiche-titre" class="bp-pro__statement">${title}</h1>
<div class="bp-pro__panel">${body}</div>
</section>`;
}

function button(href: string, label: string): string {
  return `<div class="bp-pro__actions"><a href="${href}" class="bp-ui bp-carre bp-button" data-variant="plein">${label}</a></div>`;
}

export interface FicheFormView {
  readonly companyName: string;
  readonly locationId: string;
  readonly parts: readonly FichePart[];
}

export function ficheFormPage(view: FicheFormView, values: FicheValues, errors: FicheErrors): string {
  const shown = fieldsFor(view.parts);
  const pick = (names: readonly FicheField[]) => names.filter((name) => shown.includes(name));
  const alert = Object.keys(errors).length > 0 ? `<p class="bp-pro__error" role="alert">Certaines informations sont à corriger\u202F: elles sont signalées sous chaque champ.</p>` : "";
  return frame(
    "Votre fiche pro",
    `<p class="bp-pro__company"><span class="bp-ui bp-pro__small">Fiche de</span><span class="bp-pro__company-name">${escapeForLiquid(view.companyName)}</span></p>
<p class="bp-pro__text">Il nous manque ${describeMissing(view.parts)}. Nous en avons besoin pour préparer vos commandes et vous livrer.</p>
${alert}
<form class="bp-pro__form" method="post" action="${FICHE_ACTION}" novalidate onsubmit="${ONE_SUBMIT}">
<input type="hidden" name="lieu" value="${escapeForLiquid(numericId(view.locationId))}">
${group("La personne de contact", pick(["firstName", "lastName", "phone"]), values, errors)}
${group("Adresse de livraison", pick(["street", "postalCode", "city", "country"]), values, errors)}
<button type="submit" class="bp-ui bp-carre bp-button" data-variant="plein">Enregistrer ma fiche</button>
</form>
<p class="bp-fiche__help">Pour changer une information déjà enregistrée, écrivez-nous ou appelez-nous.</p>`,
  );
}

export function ficheDonePage(companyName: string, justSaved: boolean): string {
  const title = justSaved ? "Merci, votre fiche pro est complète." : "Votre fiche pro est complète.";
  return frame(
    title,
    `<p class="bp-pro__company"><span class="bp-ui bp-pro__small">Fiche de</span><span class="bp-pro__company-name">${escapeForLiquid(companyName)}</span></p>
<p class="bp-pro__text">Nous avons votre nom, votre téléphone et l’adresse de livraison.</p>
${button(PRO_PAGE, "Retour à l’Espace pro")}`,
  );
}

export function ficheLoginPage(): string {
  return frame("Votre fiche pro", `<p class="bp-pro__text">Connectez-vous avec l’e-mail de votre compte pro pour compléter votre fiche.</p>${button(LOGIN_URL, "Se connecter")}`);
}

export function ficheNotProPage(): string {
  return frame(
    "Votre fiche pro",
    `<p class="bp-pro__text">Votre compte n’est pas encore rattaché à une entreprise\u202F: il n’a pas de fiche pro à compléter.</p>${button(PRO_PAGE, "Aller à l’Espace pro")}`,
  );
}

export function ficheUnavailablePage(): string {
  return frame(
    "Votre fiche pro",
    `<p class="bp-pro__text">La fiche n’a pas pu être lue ou enregistrée pour le moment. Réessayez dans quelques minutes\u202F: ce qui est déjà enregistré le reste.</p>${button(FICHE_ACTION, "Réessayer")}`,
  );
}
