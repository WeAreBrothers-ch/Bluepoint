import { Prisma, type AbaNinjaSale } from "@prisma/client";
import prisma from "../../db.server";
import { failure, success, toError, type Result } from "../core/result";

/**
 * Ventes passées dans AbaNinja : une ligne par commande. La ligne est prise AVANT tout appel à AbaNinja
 * (qui ne protège pas des doublons). Les réservations (ligne, facture, paiement) et l'état du bon sont des
 * UPDATE conditionnels atomiques : un seul appelant gagne, et un état plus avancé n'est jamais écrasé.
 * markInvoice et markPayment notent sans condition le résultat d'une étape déjà réservée par l'appelant.
 */

export type { AbaNinjaSale };

export interface SaleClaim {
  readonly shop: string;
  readonly orderId: string;
  readonly orderName: string;
  readonly reference: string;
  readonly isTest: boolean;
}

/** Client d'essai resté dans AbaNinja : noté pour que l'effacement le retrouve. */
export interface LeftClient {
  readonly addressUuid?: string;
  readonly companyUuid?: string;
}

export type NoteUpdate =
  | { readonly state: "cree"; readonly noteUuid: string; readonly noteNumber: string | null; readonly addressUuid: string; readonly companyUuid: string }
  | ({ readonly state: "incertain" | "refuse"; readonly errorCode: string } & LeftClient)
  | { readonly state: "annule" | "converti"; readonly errorCode?: string };

export type InvoiceUpdate =
  | { readonly state: "creee"; readonly invoiceUuid: string; readonly invoiceNumber: string | null }
  | { readonly state: "incertaine" | "refusee"; readonly errorCode: string };

async function guarded<T>(task: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return success(await task());
  } catch (thrown) {
    return failure(toError(thrown));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function updated(orderId: string, data: Prisma.AbaNinjaSaleUpdateManyMutationInput): Promise<AbaNinjaSale> {
  await prisma.abaNinjaSale.updateMany({ where: { orderId }, data });
  const sale = await prisma.abaNinjaSale.findUnique({ where: { orderId } });
  if (sale === null) throw new Error("Vente AbaNinja introuvable");
  return sale;
}

/** Prend la ligne de la commande ; si elle existe déjà, la renvoie avec claimed:false (l'appelant n'appelle pas AbaNinja). */
export function claimSale(input: SaleClaim): Promise<Result<{ readonly sale: AbaNinjaSale; readonly claimed: boolean }, Error>> {
  return guarded(async () => {
    try {
      return { sale: await prisma.abaNinjaSale.create({ data: { ...input, noteState: "en_cours" } }), claimed: true };
    } catch (thrown) {
      if (!isUniqueViolation(thrown)) throw thrown;
      const existing = await prisma.abaNinjaSale.findUnique({ where: { orderId: input.orderId } });
      if (existing === null) throw new Error("Référence de bon déjà prise par une autre commande");
      return { sale: existing, claimed: false };
    }
  });
}

export function findSale(orderId: string): Promise<Result<AbaNinjaSale | null, Error>> {
  return guarded(() => prisma.abaNinjaSale.findUnique({ where: { orderId } }));
}

/** Rien n'a été créé dans AbaNinja : la ligne disparaît pour qu'un nouvel essai puisse la reprendre. */
export function releaseRefusedSale(orderId: string): Promise<Result<void, Error>> {
  return guarded(async () => {
    await prisma.abaNinjaSale.deleteMany({ where: { orderId, noteState: "refuse" } });
  });
}

function noteData(update: NoteUpdate): Prisma.AbaNinjaSaleUpdateManyMutationInput {
  if (update.state === "cree") {
    const { state, ...made } = update;
    return { noteState: state, ...made };
  }
  const { state, errorCode, ...client } = update;
  return { noteState: state, ...client, ...(errorCode === undefined ? {} : { lastErrorCode: errorCode }) };
}

/** L'état d'où chaque état du bon peut venir : « annule » ne remplace jamais « converti », ni l'inverse. */
const NOTE_COMES_FROM: Readonly<Record<NoteUpdate["state"], string>> = {
  cree: "en_cours",
  incertain: "en_cours",
  refuse: "en_cours",
  annule: "cree",
  converti: "cree",
};

/** Note ce qu'AbaNinja a fait du bon ; faux si la ligne n'était plus dans l'état attendu (rien n'est changé). */
export function markNote(orderId: string, update: NoteUpdate): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaSale.updateMany({ where: { orderId, noteState: NOTE_COMES_FROM[update.state] }, data: noteData(update) });
    return count === 1;
  });
}

/** Réserve la facture du bon : vrai pour un seul appelant, et seulement si le bon est fait. */
export function claimConversion(orderId: string): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaSale.updateMany({
      where: { orderId, noteState: "cree", invoiceState: null },
      data: { invoiceState: "en_cours" },
    });
    return count === 1;
  });
}

/** « refusee » : AbaNinja n'a rien créé, la réservation est rendue (invoiceState null). */
export function markInvoice(orderId: string, update: InvoiceUpdate): Promise<Result<AbaNinjaSale, Error>> {
  const data =
    update.state === "creee"
      ? { invoiceState: "creee", invoiceUuid: update.invoiceUuid, invoiceNumber: update.invoiceNumber }
      : { invoiceState: update.state === "refusee" ? null : "incertaine", lastErrorCode: update.errorCode };
  return guarded(() => updated(orderId, data));
}

/** Le paiement est dans AbaNinja (inscrit par l'app, ou trouvé déjà payé). */
export function markPayment(orderId: string, state: "inscrit"): Promise<Result<AbaNinjaSale, Error>> {
  return guarded(() => updated(orderId, { paymentState: state }));
}

/**
 * Réserve l'inscription du paiement AVANT de l'envoyer (il passe « à vérifier ») : si « J'ai livré » et le
 * webhook de livraison arrivent ensemble, une seule exécution l'envoie. Faux : quelqu'un l'a déjà réservé.
 */
export function claimPayment(orderId: string): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaSale.updateMany({ where: { orderId, paymentState: null }, data: { paymentState: "incertain" } });
    return count === 1;
  });
}

/** AbaNinja a refusé le paiement (rien n'est inscrit) : la réservation est rendue pour un nouvel essai. */
export function releasePayment(orderId: string): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaSale.updateMany({ where: { orderId, paymentState: "incertain" }, data: { paymentState: null } });
    return count === 1;
  });
}

/** Les essais de la boutique, plus récents d'abord (page « Connexion AbaNinja »). */
export function listTestSales(shop: string): Promise<Result<AbaNinjaSale[], Error>> {
  return guarded(() => prisma.abaNinjaSale.findMany({ where: { shop, isTest: true }, orderBy: { createdAt: "desc" }, take: 50 }));
}
