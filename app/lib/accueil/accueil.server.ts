import prisma from "../../db.server";
import { logError, logInfo } from "../core/logger.server";

/**
 * Ce que la page d'accueil publique (« / ») lit côté serveur quand elle s'ouvre sans le nom de la boutique.
 */

/** La boutique où l'app est installée (app sur mesure : une seule). null si la base ne répond pas ou si l'app n'est pas installée. */
export async function findInstalledShop(): Promise<string | null> {
  try {
    const session = await prisma.session.findFirst({ where: { isOnline: false }, orderBy: { id: "asc" }, select: { shop: true } });
    return session?.shop ?? null;
  } catch (error) {
    logError("Accueil : boutique de l’app illisible", error);
    return null;
  }
}

/** D'où vient la visite, sans les paramètres (ils peuvent contenir un jeton de session) : une page de l'app, ou un site. */
function visitSource(request: Request): string {
  const referer = request.headers.get("referer");
  if (referer === null) return "inconnu";
  try {
    const from = new URL(referer);
    return from.origin === new URL(request.url).origin ? from.pathname : from.hostname;
  } catch {
    return "illisible";
  }
}

/** Trace dans le journal Vercel, pour comprendre comment on arrive sur l'accueil sans le nom de la boutique. */
export function logBareVisit(request: Request): void {
  logInfo("Accueil ouvert sans boutique", {
    cadre: request.headers.get("sec-fetch-dest") ?? "inconnu",
    depuis: visitSource(request),
  });
}
