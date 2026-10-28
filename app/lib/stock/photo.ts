import { normalizeSearch } from "../commande/catalog";

/**
 * Photo d'un vin envoyée depuis l'app. Le navigateur la réduit d'abord (côté le plus long : 1600 px,
 * en JPEG) : l'envoi est rapide même depuis un téléphone, et reste sous la limite du serveur.
 */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.85;
/** Garde-fou côté serveur : une photo réduite pèse bien moins. */
export const MAX_PHOTO_BYTES = 4_000_000;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface PhotoFile {
  readonly type: string;
  readonly size: number;
}

/** `null` si la photo convient, sinon le message à afficher. */
export function photoProblem(file: PhotoFile): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) return "Ce fichier n’est pas une photo que Shopify accepte (JPEG, PNG ou WebP).";
  if (file.size <= 0) return "Cette photo est vide. Choisissez-en une autre.";
  if (file.size > MAX_PHOTO_BYTES) return "Cette photo est trop lourde. Choisissez-en une autre.";
  return null;
}

/** Nom du fichier chez Shopify, d'après le nom du vin : « chasselas-2025.jpg ». */
export function photoFilename(title: string, type: string): string {
  const base = normalizeSearch(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return `${base === "" ? "vin" : base}.${extension}`;
}

/** Une photo envoyée par le formulaire, ou `null` si aucune n'a été choisie. */
export function formPhoto(form: FormData): File | null {
  const value = form.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
}

export type PhotoResult =
  | { readonly ok: true; readonly intent: "photo"; readonly productId: string; readonly message: string }
  | { readonly ok: false; readonly intent: "photo"; readonly productId: string | null; readonly message: string };

export const PHOTO_UNREADABLE = "Cette photo ne peut pas être lue ici. Essayez une autre photo (JPEG ou PNG).";
