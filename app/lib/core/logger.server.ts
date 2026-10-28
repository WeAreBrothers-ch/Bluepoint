/**
 * Journal serveur unique de l'app : c'est le seul fichier autorisé à écrire
 * dans la console. Les journaux partent dans les logs Vercel (ou Docker).
 * Ne jamais y passer de données personnelles (nom, adresse, e-mail du client).
 */

type LogContext = Readonly<Record<string, string | number | boolean | null>>;

function format(message: string, context?: LogContext): string {
  return context ? `${message} ${JSON.stringify(context)}` : message;
}

export function logInfo(message: string, context?: LogContext): void {
  // eslint-disable-next-line no-console
  console.info(format(message, context));
}

export function logError(message: string, error: unknown, context?: LogContext): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  // eslint-disable-next-line no-console
  console.error(format(message, context), detail);
}
