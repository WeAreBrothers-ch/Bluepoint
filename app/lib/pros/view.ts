import type { ProRequest } from "@prisma/client";
import { phoneDisplay } from "../agenda/contact";
import { longDay, swissIsoDate } from "../agenda/dates";
import type { ProRequestErrors, ProRequestValues } from "./request";

/** Demande de compte pro telle qu'affichée dans l'app (sérialisable, mots simples). */

export interface ProRequestView {
  readonly id: string;
  readonly companyName: string;
  readonly personName: string;
  readonly email: string;
  readonly phone: string;
  readonly addressLines: readonly string[];
  readonly vatNumber: string | null;
  readonly message: string | null;
  /** Ex. « Reçue par le site le mardi 28 octobre ». */
  readonly receivedLabel: string;
  /** Ex. « Acceptée le mercredi 29 octobre », ou null tant qu'elle attend. */
  readonly decisionLabel: string | null;
  readonly accepted: boolean;
}

export function toProRequestView(request: ProRequest): ProRequestView {
  const via = request.source === "app" ? "Ajoutée dans l’app" : "Reçue par le site";
  const decision =
    request.decidedAt === null || request.status === "en_attente"
      ? null
      : `${request.status === "acceptee" ? "Acceptée" : "Refusée"} le ${longDay(swissIsoDate(request.decidedAt))}`;
  return {
    id: request.id,
    companyName: request.companyName,
    personName: `${request.firstName} ${request.lastName}`,
    email: request.email,
    phone: phoneDisplay(request.phone),
    addressLines: [request.street, `${request.postalCode} ${request.city}`, ...(request.country === "LI" ? ["Liechtenstein"] : [])],
    vatNumber: request.vatNumber,
    message: request.message,
    receivedLabel: `${via} le ${longDay(swissIsoDate(request.createdAt))}`,
    decisionLabel: decision,
    accepted: request.status === "acceptee",
  };
}

export type ProsIntent = "accepter" | "refuser" | "ajouter";

export function isProsIntent(value: unknown): value is ProsIntent {
  return value === "accepter" || value === "refuser" || value === "ajouter";
}

export type ProsActionResult =
  | { readonly ok: true; readonly intent: ProsIntent; readonly requestId: string | null; readonly message: string }
  | {
      readonly ok: false;
      readonly intent: ProsIntent | null;
      readonly requestId: string | null;
      readonly message: string;
      /** Formulaire « Ajouter un client pro » à corriger. */
      readonly errors?: ProRequestErrors;
      readonly values?: ProRequestValues;
    };
