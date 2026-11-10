import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { AbaNinjaError } from "./errors";

/** Lecture d'un corps de réponse avec une taille maximale (protège la mémoire du serveur). */

function tooLarge(): AbaNinjaError {
  return new AbaNinjaError("reponse_invalide", { message: "La réponse d'AbaNinja est trop volumineuse." });
}

/** Libère la connexion sans lire le corps ; un échec est journalisé, pas avalé. */
export async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch (thrown) {
    logError("AbaNinja : impossible de fermer le corps de la réponse", thrown);
  }
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function readChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  maxBytes: number,
): Promise<Result<Uint8Array, AbaNinjaError>> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return success(concat(chunks, total));
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return failure(tooLarge());
    }
    chunks.push(value);
  }
}

export async function readBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<Result<Uint8Array, AbaNinjaError>> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    await discardBody(response);
    return failure(tooLarge());
  }
  if (response.body === null) return success(new Uint8Array());
  try {
    return await readChunks(response.body.getReader(), maxBytes);
  } catch (thrown) {
    return failure(new AbaNinjaError("indisponible", { cause: thrown }));
  }
}
