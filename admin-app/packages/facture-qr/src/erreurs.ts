/** Erreur prévue, avec un message en français lisible par l'utilisateur. */
export class FactureError extends Error {
  /** Liste des problèmes détaillés (un par champ fautif), vide si l'erreur est unique. */
  readonly details: readonly string[];

  constructor(message: string, details: readonly string[] = []) {
    super(message);
    this.name = "FactureError";
    this.details = details;
  }
}
