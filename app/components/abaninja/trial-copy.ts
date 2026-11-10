import { TRIAL_DEADLINE_MS, RESOLVE_AFTER_MS } from "../../lib/abaninja/trial-policy";
import { frenchTypography } from "../../lib/abaninja/trial-typography";

/** Textes fixes de la page « Connexion AbaNinja », avec la typographie française appliquée une fois pour toutes. */

const DEADLINE_SECONDS = TRIAL_DEADLINE_MS / 1000;
const RESOLVE_MINUTES = RESOLVE_AFTER_MS / 60_000;

export const COPY = {
  intro: frenchTypography(
    `L’essai crée une fausse facture de 1 CHF, vérifie qu’AbaNinja répond et que le PDF se télécharge, puis l’efface. Il dure en général une quinzaine de secondes et s’arrête de lui-même au bout de ${DEADLINE_SECONDS} secondes. Vos vraies factures ne sont pas touchées.`,
  ),
  busy: frenchTypography(`Patientez, cela prend en général une quinzaine de secondes (au plus ${DEADLINE_SECONDS}). Ne quittez pas la page.`),
  finished: frenchTypography("Essai terminé. Le résultat est ci-dessous."),
  modalHeading: frenchTypography("Lancer un essai ?"),
  modalBody: frenchTypography("Une facture fictive de 1 CHF va être créée dans AbaNinja, puis supprimée. Rien n’est envoyé à vos clients."),
  modalNumber: frenchTypography(
    "Même pour un essai, AbaNinja peut consommer un numéro de facture : un trou dans votre numérotation reste possible.",
  ),
  keepLabel: frenchTypography("Garder la facture d’essai pour que je la regarde dans AbaNinja"),
  keepDetails: frenchTypography("Elle ne sera pas supprimée : il faudra l’effacer vous-même ensuite."),
  start: "Lancer l’essai",
  cancel: "Annuler",
  launch: "Lancer un essai",
  running: "Essai en cours…",
  resolveReferenceLabel: frenchTypography("Référence à chercher dans AbaNinja : "),
  resolveHeading: frenchTypography("Débloquer le dernier essai ?"),
  resolveBody: frenchTypography(
    "À ne faire qu’après avoir cherché la référence ci-dessus dans AbaNinja (factures, y compris brouillons et supprimées). Si la facture existe, supprimez-la d’abord.",
  ),
  resolveButton: frenchTypography("J’ai vérifié dans AbaNinja : la facture d’essai n’existe pas"),
  resolveConfirm: "Oui, elle n’existe pas",
  resolveWaitPrefix: frenchTypography(`Le déblocage est possible ${RESOLVE_MINUTES} minutes après l’essai. Encore environ`),
  noTrial: "Aucun essai pour le moment.",
  unreadable: "Le dernier essai n’a pas pu être retrouvé. Réessayez dans quelques instants.",
  failureHelp: frenchTypography(
    "Rien n’a été envoyé à un client. Lisez le message de l’étape en échec : il dit quoi faire. S’il ne suffit pas, prenez l’écran en photo et envoyez-la à la personne qui s’occupe de l’application.",
  ),
  blockedHeading: frenchTypography("Essai non lancé"),
  blockedNote: "Aucun appel n’a été fait à AbaNinja.",
} as const;
