/**
 * Lecture des variables d'environnement côté serveur.
 * Une variable obligatoire absente fait échouer tôt et clairement,
 * plutôt que de laisser l'app démarrer à moitié configurée.
 */

export function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

export function readListEnv(name: string): string[] {
  return readRequiredEnv(name)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}
