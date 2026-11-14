import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import {
  FICHE_METAFIELDS,
  ficheSavedMessage,
  ficheTags,
  ficheValuesFromProduct,
  METAFIELD_NAMESPACE,
  parseFiche,
  regionChoices,
  type FicheLoadResult,
  type FicheProduct,
  type FicheResult,
} from "./fiche";

/**
 * « Modifier la fiche » d'un vin (page Stock) : lit la fiche dans Shopify, puis enregistre le nom, le producteur,
 * la sorte, les étiquettes (pays, région, année, appellation, contenance) et les métachamps « bluepoint » (`write_products`).
 */

const METAFIELDS_SELECTION = `
    region: metafield(namespace: "bluepoint", key: "region") { value }
    cepage: metafield(namespace: "bluepoint", key: "cepage") { value }
    degre: metafield(namespace: "bluepoint", key: "degre") { value }
    degustation: metafield(namespace: "bluepoint", key: "degustation") { value }
    producteur: metafield(namespace: "bluepoint", key: "producteur") { value }
    service: metafield(namespace: "bluepoint", key: "service") { value }
    conservation: metafield(namespace: "bluepoint", key: "conservation") { value }
    volume_ml: metafield(namespace: "bluepoint", key: "volume_ml") { value }`;

const FICHE_QUERY = `#graphql
query FicheDuVin($id: ID!) {
  product(id: $id) {
    id title vendor productType tags${METAFIELDS_SELECTION}
  }
  productTags(first: 250) { nodes }
}`;

const CURRENT_QUERY = `#graphql
query FicheAvantEnregistrement($id: ID!) {
  product(id: $id) {
    id title tags${METAFIELDS_SELECTION}
  }
}`;

const UPDATE_MUTATION = `#graphql
mutation EnregistrerLaFiche($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title }
    userErrors { field message }
  }
}`;

const DELETE_MUTATION = `#graphql
mutation EffacerDesCasesDeLaFiche($metafields: [MetafieldIdentifierInput!]!) {
  metafieldsDelete(metafields: $metafields) {
    deletedMetafields { key }
    userErrors { field message }
  }
}`;

type MetafieldValue = { readonly value: string } | null;

interface ProductMetafields {
  readonly region: MetafieldValue;
  readonly cepage: MetafieldValue;
  readonly degre: MetafieldValue;
  readonly degustation: MetafieldValue;
  readonly producteur: MetafieldValue;
  readonly service: MetafieldValue;
  readonly conservation: MetafieldValue;
  readonly volume_ml: MetafieldValue;
}

interface FicheData {
  readonly product: (ProductMetafields & { readonly id: string; readonly title: string; readonly vendor: string; readonly productType: string; readonly tags: readonly string[] }) | null;
  readonly productTags: { readonly nodes: readonly string[] } | null;
}

interface CurrentData {
  readonly product: (ProductMetafields & { readonly id: string; readonly title: string; readonly tags: readonly string[] }) | null;
}

interface UserErrorsPayload {
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface UpdateData {
  readonly productUpdate: (UserErrorsPayload & { readonly product: { readonly id: string; readonly title: string } | null }) | null;
}

interface DeleteData {
  readonly metafieldsDelete: (UserErrorsPayload & { readonly deletedMetafields: readonly ({ readonly key: string } | null)[] | null }) | null;
}

function ficheProduct(product: NonNullable<FicheData["product"]>): FicheProduct {
  return {
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    metafields: {
      // Le métachamp « region » est la ligne « Région » de la fiche ; le menu du site, lui, lit l'étiquette « region:… ».
      regionLine: product.region?.value ?? null,
      cepage: product.cepage?.value ?? null,
      degre: product.degre?.value ?? null,
      degustation: product.degustation?.value ?? null,
      producteur: product.producteur?.value ?? null,
      service: product.service?.value ?? null,
      conservation: product.conservation?.value ?? null,
      volume_ml: product.volume_ml?.value ?? null,
    },
  };
}

/** Les métachamps que le vin a vraiment : on n'efface que ceux-là. */
function existingKeys(product: ProductMetafields): Set<string> {
  const keys = new Set<string>();
  for (const { key } of Object.values(FICHE_METAFIELDS)) {
    if (product[key] !== null) keys.add(key);
  }
  return keys;
}

export async function loadFiche(admin: AdminApiContext, productId: string): Promise<FicheLoadResult> {
  const id = parseGid(productId, "Product");
  if (id === null) return { ok: false, message: "Ce vin est introuvable. Rechargez la page." };
  const result = await runAdminGraphql<FicheData>(admin, FICHE_QUERY, { id });
  if (!result.ok) {
    logError("Fiche du vin illisible", result.error, { productId });
    return { ok: false, message: "Shopify ne répond pas pour le moment. Réessayez dans un instant." };
  }
  const { product, productTags } = result.value;
  if (product === null) return { ok: false, message: "Ce vin n’existe plus." };
  return { ok: true, productId: product.id, values: ficheValuesFromProduct(ficheProduct(product)), regions: regionChoices(productTags?.nodes ?? []) };
}

function refusalMessage(error: Error, fallback: string): string {
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  const denied = /access denied|access scope/i.test(error.message);
  return plain ?? (denied ? "L’app n’a pas le droit de modifier les vins. Contactez la personne qui l’a installée." : fallback);
}

export async function handleFicheChange(admin: AdminApiContext, form: FormData): Promise<FicheResult> {
  const rawProduct = form.get("productId");
  const productId = typeof rawProduct === "string" ? rawProduct : "";
  const id = parseGid(productId, "Product");
  if (id === null) {
    return { ok: false, intent: "fiche", productId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez.", values: null, errors: {} };
  }
  const parsed = parseFiche(form);
  if (!parsed.ok) {
    return { ok: false, intent: "fiche", productId, message: "Une case est à corriger (en rouge).", values: parsed.values, errors: parsed.errors };
  }
  const { input } = parsed;

  // Les étiquettes sont relues juste avant : celles que la fiche ne touche pas (promotions, « pro »…) restent telles quelles.
  const current = await runAdminGraphql<CurrentData>(admin, CURRENT_QUERY, { id });
  if (!current.ok) {
    logError("Fiche du vin : vin illisible avant l’enregistrement", current.error, { productId });
    return { ok: false, intent: "fiche", productId, message: "Shopify ne répond pas pour le moment. Réessayez dans un instant.", values: input.values, errors: {} };
  }
  const product = current.value.product;
  if (product === null) return { ok: false, intent: "fiche", productId, message: "Ce vin n’existe plus.", values: null, errors: {} };

  const updated = await runAdminMutation(admin, UPDATE_MUTATION, (data: UpdateData) => data.productUpdate, {
    product: {
      id,
      title: input.title,
      vendor: input.vendor,
      productType: input.productType,
      tags: ficheTags(product.tags, input),
      metafields: input.metafields,
    },
  });
  if (!updated.ok) {
    logError("Fiche du vin non enregistrée", updated.error, { productId });
    return {
      ok: false,
      intent: "fiche",
      productId,
      message: refusalMessage(updated.error, "La fiche n’a pas pu être enregistrée. Réessayez dans un instant."),
      values: input.values,
      errors: {},
    };
  }

  // Les cases vidées : on efface le métachamp, sinon l'ancien texte resterait sur le site.
  const present = existingKeys(product);
  const toDelete = input.clearedKeys.filter((key) => present.has(key));
  if (toDelete.length > 0) {
    const deleted = await runAdminMutation(admin, DELETE_MUTATION, (data: DeleteData) => data.metafieldsDelete, {
      metafields: toDelete.map((key) => ({ ownerId: id, namespace: METAFIELD_NAMESPACE, key })),
    });
    if (!deleted.ok) {
      logError("Fiche du vin : cases vidées non effacées", deleted.error, { productId, keys: toDelete.join(",") });
      return {
        ok: false,
        intent: "fiche",
        productId,
        message: "La fiche est enregistrée, mais les cases que vous avez vidées n’ont pas pu être effacées sur le site. Réessayez.",
        values: input.values,
        errors: {},
      };
    }
  }

  logInfo("Fiche du vin enregistrée", { productId, effaces: toDelete.join(",") });
  return { ok: true, intent: "fiche", productId, message: ficheSavedMessage(input.title) };
}
