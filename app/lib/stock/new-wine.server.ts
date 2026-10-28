import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { normalizeSearch } from "../commande/catalog";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { createdMessage, parseNewWine, shopifyPrice, type NewWineInput, type NewWineResult } from "./new-wine";
import { formPhoto, photoProblem } from "./photo";
import { photoFiles, uploadPhoto } from "./photo.server";

/**
 * « Nouveau vin » : crée le produit actif avec son prix et son stock au dépôt (`productSet`),
 * puis le met en vente là où sont déjà les autres vins (le site, en pratique).
 */

export const NEW_WINE_SCOPES = ["write_products", "read_locations", "write_files"] as const;

const PLACES_QUERY = `#graphql
query OuMettreLeVin($title: String!) {
  locations(first: 5) { nodes { id isActive } }
  products(first: 10) { nodes { title resourcePublications(first: 10) { nodes { isPublished publication { id } } } } }
  sameName: products(first: 5, query: $title) { nodes { title } }
}`;

interface PlacesData {
  readonly locations: { readonly nodes: readonly { readonly id: string; readonly isActive: boolean }[] };
  readonly products: {
    readonly nodes: readonly {
      readonly title: string;
      readonly resourcePublications: { readonly nodes: readonly { readonly isPublished: boolean; readonly publication: { readonly id: string } }[] };
    }[];
  };
  readonly sameName: { readonly nodes: readonly { readonly title: string }[] };
}

/** Sans le droit de lire les canaux de vente, on sait quand même créer le vin : on lit le reste seul. */
const PLACES_WITHOUT_CHANNELS_QUERY = `#graphql
query OuMettreLeVinSansCanaux($title: String!) {
  locations(first: 5) { nodes { id isActive } }
  sameName: products(first: 5, query: $title) { nodes { title } }
}`;

const CREATE_MUTATION = `#graphql
mutation NouveauVin($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product { id }
    userErrors { field message }
  }
}`;

const PUBLISH_MUTATION = `#graphql
mutation MettreEnVente($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}`;

interface CreatePayload {
  readonly product: { readonly id: string } | null;
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface PublishPayload {
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface Places {
  readonly locationId: string | null;
  readonly publicationIds: readonly string[];
  readonly duplicate: boolean;
}

async function readPlaces(admin: AdminApiContext, variables: { readonly title: string }): Promise<PlacesData | null> {
  const full = await runAdminGraphql<PlacesData>(admin, PLACES_QUERY, variables);
  if (full.ok) return full.value;
  // Sans le droit de lire les canaux de vente, le vin est quand même créé (pas encore sur le site).
  logError("Nouveau vin : canaux de vente illisibles", full.error);
  const base = await runAdminGraphql<Omit<PlacesData, "products">>(admin, PLACES_WITHOUT_CHANNELS_QUERY, variables);
  if (!base.ok) {
    logError("Nouveau vin : dépôt illisible", base.error);
    return null;
  }
  return { ...base.value, products: { nodes: [] } };
}

async function findPlaces(admin: AdminApiContext, title: string): Promise<Places | null> {
  const data = await readPlaces(admin, { title: `title:${JSON.stringify(title)}` });
  if (data === null) return null;
  const publicationIds = new Set(
    data.products.nodes.flatMap((product) =>
      product.resourcePublications.nodes.filter((entry) => entry.isPublished).map((entry) => entry.publication.id),
    ),
  );
  const wanted = normalizeSearch(title);
  return {
    locationId: data.locations.nodes.find((location) => location.isActive)?.id ?? null,
    publicationIds: [...publicationIds],
    duplicate: data.sameName.nodes.some((product) => normalizeSearch(product.title) === wanted),
  };
}

function productInput(input: NewWineInput, locationId: string, files: ReturnType<typeof photoFiles> | null) {
  return {
    title: input.title,
    status: "ACTIVE",
    ...(files === null ? {} : { files }),
    ...(input.vendor === null ? {} : { vendor: input.vendor }),
    ...(input.productType === null ? {} : { productType: input.productType }),
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }],
    variants: [
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: shopifyPrice(input.priceCents),
        inventoryItem: { tracked: true },
        inventoryQuantities: [{ locationId, name: "available", quantity: input.quantity }],
      },
    ],
  };
}

export async function handleNewWine(admin: AdminApiContext, form: FormData): Promise<NewWineResult> {
  const parsed = parseNewWine(form);
  if (!parsed.ok) {
    return { ok: false, intent: "nouveau_vin", message: "Il manque quelque chose : regardez les cases en rouge.", values: parsed.values, errors: parsed.errors };
  }
  const { input } = parsed;
  const values = {
    title: input.title,
    vendor: input.vendor ?? "",
    type: input.productType ?? "Autre",
    price: shopifyPrice(input.priceCents),
    quantity: String(input.quantity),
  };
  const places = await findPlaces(admin, input.title);
  if (places === null || places.locationId === null) {
    return { ok: false, intent: "nouveau_vin", message: "Shopify ne répond pas pour le moment. Réessayez dans un instant : rien n’a été créé.", values, errors: {} };
  }
  if (places.duplicate) {
    return {
      ok: false,
      intent: "nouveau_vin",
      message: "Un vin porte déjà ce nom. Ajoutez des bouteilles à ce vin plutôt, ou changez le nom (par exemple avec l’année).",
      values,
      errors: { title: "Ce nom existe déjà." },
    };
  }
  const photo = formPhoto(form);
  const problem = photo === null ? null : photoProblem(photo);
  if (problem !== null) return { ok: false, intent: "nouveau_vin", message: problem, values, errors: {} };
  // Photo refusée par Shopify : le vin est quand même créé, la photo pourra être ajoutée ensuite.
  const uploaded = photo === null ? null : await uploadPhoto(admin, photo, input.title);
  if (uploaded !== null && !uploaded.ok) logError("Photo du nouveau vin non envoyée", uploaded.error, { title: input.title });
  const files = uploaded?.ok ? photoFiles(uploaded.value, input.title) : null;
  const created = await runAdminMutation(admin, CREATE_MUTATION, (data: { readonly productSet: CreatePayload }) => data.productSet, {
    input: productInput(input, places.locationId, files),
  });
  if (!created.ok || created.value.product === null) {
    if (!created.ok) logError("Nouveau vin refusé", created.error, { title: input.title });
    const denied = !created.ok && /access denied|access scope/i.test(created.error.message);
    const message = denied
      ? "L’app n’a pas encore le droit de créer des vins. Il faut d’abord faire l’étape d’autorisation (cadre jaune en haut de la page)."
      : "Shopify n’a pas pu créer ce vin. Réessayez dans un instant.";
    return { ok: false, intent: "nouveau_vin", message, values, errors: {} };
  }
  const productId = created.value.product.id;
  let published = false;
  if (places.publicationIds.length > 0) {
    const publish = await runAdminMutation(admin, PUBLISH_MUTATION, (data: { readonly publishablePublish: PublishPayload }) => data.publishablePublish, {
      id: productId,
      input: places.publicationIds.map((publicationId) => ({ publicationId })),
    });
    if (publish.ok) published = true;
    else logError("Nouveau vin créé mais pas mis en vente", publish.error, { productId });
  }
  logInfo("Nouveau vin", { productId, quantity: input.quantity, published, photo: files !== null });
  const photoMissed = photo !== null && files === null ? " La photo n’a pas pu être envoyée : ajoutez-la avec « Ajouter une photo »." : "";
  return { ok: true, intent: "nouveau_vin", message: `${createdMessage(input, published)}${photoMissed}` };
}
