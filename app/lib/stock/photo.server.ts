import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { ShopifyRequestError, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { formPhoto, photoFilename, photoProblem, type PhotoResult } from "./photo";

/**
 * Envoi d'une photo de vin chez Shopify en deux temps : un emplacement temporaire
 * (`stagedUploadsCreate`), puis la photo est rattachée au vin et remplace l'ancienne (`productSet`,
 * liste `files` seule : le nom, le prix et le stock ne changent pas).
 */

const STAGED_UPLOAD_MUTATION = `#graphql
mutation EmplacementPhoto($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}`;

const SET_PHOTO_MUTATION = `#graphql
mutation PhotoDuVin($id: ID!, $input: ProductSetInput!) {
  productSet(synchronous: true, identifier: { id: $id }, input: $input) {
    product { id }
    userErrors { field message }
  }
}`;

interface StagedPayload {
  readonly stagedTargets: readonly {
    readonly url: string | null;
    readonly resourceUrl: string | null;
    readonly parameters: readonly { readonly name: string; readonly value: string }[];
  }[];
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface ProductSetPayload {
  readonly product: { readonly id: string } | null;
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

/** Dépose la photo chez Shopify ; renvoie l'adresse à donner comme `originalSource`. */
export async function uploadPhoto(admin: AdminApiContext, file: File, title: string): Promise<Result<string, ShopifyGraphqlError>> {
  const filename = photoFilename(title, file.type);
  const staged = await runAdminMutation(admin, STAGED_UPLOAD_MUTATION, (data: { readonly stagedUploadsCreate: StagedPayload }) => data.stagedUploadsCreate, {
    input: [{ resource: "IMAGE", filename, mimeType: file.type, httpMethod: "POST", fileSize: String(file.size) }],
  });
  if (!staged.ok) return staged;
  const target = staged.value.stagedTargets[0];
  if (target?.url == null || target.resourceUrl == null) return failure(new ShopifyRequestError("Emplacement de photo absent"));
  const body = new FormData();
  for (const parameter of target.parameters) body.append(parameter.name, parameter.value);
  body.append("file", file, filename);
  try {
    const response = await fetch(target.url, { method: "POST", body });
    if (!response.ok) return failure(new ShopifyRequestError(`Envoi de la photo refusé (${response.status})`));
  } catch (thrown) {
    return failure(new ShopifyRequestError("Envoi de la photo impossible", { cause: thrown }));
  }
  return success(target.resourceUrl);
}

/** Pour `productSet` : la photo comme seul média du vin. */
export function photoFiles(resourceUrl: string, title: string) {
  return [{ originalSource: resourceUrl, contentType: "IMAGE", alt: title }];
}

export async function handlePhotoChange(admin: AdminApiContext, form: FormData): Promise<PhotoResult> {
  const rawId = form.get("productId");
  const productId = typeof rawId === "string" ? parseGid(rawId, "Product") : null;
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" && rawTitle.trim() !== "" ? rawTitle.trim() : "Vin";
  const photo = formPhoto(form);
  if (productId === null) return { ok: false, intent: "photo", productId: null, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  if (photo === null) return { ok: false, intent: "photo", productId, message: "Choisissez d’abord une photo." };
  const problem = photoProblem(photo);
  if (problem !== null) return { ok: false, intent: "photo", productId, message: problem };
  const uploaded = await uploadPhoto(admin, photo, title);
  const saved = uploaded.ok
    ? await runAdminMutation(admin, SET_PHOTO_MUTATION, (data: { readonly productSet: ProductSetPayload }) => data.productSet, {
        id: productId,
        input: { files: photoFiles(uploaded.value, title) },
      })
    : uploaded;
  if (!saved.ok) {
    logError("Photo du vin non enregistrée", saved.error, { productId });
    const denied = /access denied|access scope/i.test(saved.error.message);
    const message = denied
      ? "L’app n’a pas encore le droit d’envoyer des photos. Il faut d’abord faire l’étape d’autorisation (cadre jaune en haut de la page)."
      : "La photo n’a pas pu être envoyée. Réessayez dans un instant.";
    return { ok: false, intent: "photo", productId, message };
  }
  logInfo("Photo du vin enregistrée", { productId, bytes: photo.size });
  return { ok: true, intent: "photo", productId, message: `C’est noté\u202F: la photo de « ${title} » est enregistrée. Elle apparaît sur le site dans un instant.` };
}
