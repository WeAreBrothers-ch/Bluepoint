import type { CardsListing } from "./abaninja-read.server";
import { isPrivateCustomersCard, type AbaNinjaCard } from "./cards";
import type { Candidate, CardStatus, MatchReason } from "./match";
import type { ShopifyClient, ShopifySide } from "./shopify-client";

/** Ce que la page « Clients AbaNinja » affiche, en données simples (envoyées telles quelles au navigateur). */

export type GroupKey = CardStatus["kind"];

export interface CardView {
  readonly uuid: string;
  readonly name: string;
  readonly number: string | null;
  readonly isCompany: boolean;
  readonly kindLabel: "Société" | "Personne";
  readonly email: string | null;
  /** « 1095 Lutry ». */
  readonly place: string | null;
  readonly tags: readonly string[];
}

export interface ClientView {
  readonly customerId: string;
  readonly name: string;
  readonly email: string | null;
  readonly place: string | null;
  readonly isPro: boolean;
  /** « même e-mail », « même nom », « même téléphone ». */
  readonly reasons: readonly string[];
}

export interface LinkedRow {
  readonly card: CardView;
  readonly client: ClientView;
  /** Société reliée dont le compte pro n'est pas fini (étiquette ou rôle manquant) : bouton « Terminer ». */
  readonly toFinish: boolean;
}
export interface CandidatesRow {
  readonly card: CardView;
  readonly candidates: readonly ClientView[];
}
export interface AbsentRow {
  readonly card: CardView;
  readonly canCreate: boolean;
  /** Ce que « Créer » fera, ou pourquoi ce n'est pas possible. */
  readonly note: string;
}
/** Pourquoi une fiche est mise de côté d'office (sans bouton « Remettre ») ; null si elle l'a été à la main. */
export type AutoReason = "prives" | "archivee";

export interface IgnoredRow {
  readonly card: CardView;
  readonly autoReason: AutoReason | null;
}

export interface ComparisonView {
  readonly counts: Readonly<Record<GroupKey, number>>;
  readonly groups: {
    readonly meme_email: readonly CandidatesRow[];
    readonly a_verifier: readonly CandidatesRow[];
    readonly absent: readonly AbsentRow[];
    readonly relie: readonly LinkedRow[];
    readonly ignore: readonly IgnoredRow[];
  };
  /** Sociétés « Pas encore dans la boutique » que « Créer les N » crée en clients pro (celles qui ont un e-mail libre). */
  readonly creatable: number;
  /** Fiches AbaNinja illisibles, laissées de côté. */
  readonly skipped: number;
  readonly truncated: boolean;
}

const REASON_WORDS: Readonly<Record<MatchReason, string>> = { email: "même e-mail", nom: "même nom", telephone: "même téléphone" };

type AbsentStatus = Extract<CardStatus, { kind: "absent" }>;

export function missingEmailSentence(status: AbsentStatus): string {
  if (status.sharedEmail) {
    return `L’e-mail de ${status.card.name} est aussi sur d’autres fiches d’AbaNinja\u202F: il ne désigne pas ce client. Mettez son propre e-mail dans AbaNinja, puis rechargez la page.`;
  }
  return status.blockedBy === null
    ? `${status.card.name} n’a pas d’e-mail dans AbaNinja\u202F: ajoutez-le dans AbaNinja, puis rechargez la page.`
    : `L’e-mail de ${status.card.name} est déjà celui de ${status.blockedBy} dans la boutique, relié à une autre fiche. Mettez un autre e-mail dans AbaNinja, puis rechargez la page.`;
}

/** `email` : celui qui servira (pour une fiche à créer, le premier e-mail libre). */
function cardView(card: AbaNinjaCard, email: string | null = card.emails[0] ?? null): CardView {
  const company = card.kind === "company";
  return {
    uuid: card.uuid,
    name: card.name,
    number: card.number,
    isCompany: company,
    kindLabel: company ? "Société" : "Personne",
    email,
    place: card.address === null ? null : `${card.address.zip} ${card.address.city}`,
    tags: card.tags,
  };
}

function clientView(client: ShopifyClient, reasons: readonly MatchReason[] = []): ClientView {
  return {
    customerId: client.customerId,
    name: client.displayName,
    email: client.email,
    place: client.town,
    isPro: client.isPro,
    reasons: reasons.map((reason) => REASON_WORDS[reason]),
  };
}

const candidateView = (candidate: Candidate): ClientView => clientView(candidate.client, candidate.reasons);

const NO_EMAIL_SENT = "Aucun e-mail ne lui sera envoyé.";

function personNote(status: AbsentStatus): string {
  const taken = [status.card.address === null ? null : "son adresse", status.phone === null ? null : "son téléphone"].filter(
    (part): part is string => part !== null,
  );
  return taken.length === 0 ? `Sera créé dans la boutique. ${NO_EMAIL_SENT}` : `Sera créé avec ${taken.join(" et ")} d’AbaNinja. ${NO_EMAIL_SENT}`;
}

function absentRow(status: AbsentStatus): AbsentRow {
  if (status.email === null) return { card: cardView(status.card), canCreate: false, note: missingEmailSentence(status) };
  const note = status.card.kind === "company" ? `Sera créé en client pro. ${NO_EMAIL_SENT}` : personNote(status);
  return { card: cardView(status.card, status.email), canCreate: true, note };
}

function autoReason(status: Extract<CardStatus, { kind: "ignore" }>): AutoReason | null {
  if (!status.auto) return null;
  return isPrivateCustomersCard(status.card) ? "prives" : "archivee";
}

export function toComparisonView(statuses: readonly CardStatus[], side: ShopifySide, listing: CardsListing): ComparisonView {
  const groups = {
    meme_email: [] as CandidatesRow[],
    a_verifier: [] as CandidatesRow[],
    absent: [] as AbsentRow[],
    relie: [] as LinkedRow[],
    ignore: [] as IgnoredRow[],
  };
  for (const status of statuses) {
    if (status.kind === "relie") {
      const toFinish = status.card.kind === "company" && !status.client.proReady;
      groups.relie.push({ card: cardView(status.card), client: clientView(status.client), toFinish });
    }
    else if (status.kind === "ignore") groups.ignore.push({ card: cardView(status.card), autoReason: autoReason(status) });
    else if (status.kind === "absent") groups.absent.push(absentRow(status));
    else if (status.kind === "meme_email") groups.meme_email.push({ card: cardView(status.card), candidates: [candidateView(status.candidate)] });
    else groups.a_verifier.push({ card: cardView(status.card), candidates: status.candidates.map(candidateView) });
  }
  return {
    counts: {
      meme_email: groups.meme_email.length,
      a_verifier: groups.a_verifier.length,
      absent: groups.absent.length,
      relie: groups.relie.length,
      ignore: groups.ignore.length,
    },
    groups,
    creatable: groups.absent.filter((row) => row.canCreate && row.card.isCompany).length,
    skipped: listing.skipped,
    truncated: listing.truncated || side.truncated,
  };
}
