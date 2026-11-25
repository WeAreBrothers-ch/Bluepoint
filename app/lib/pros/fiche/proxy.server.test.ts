import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

vi.mock("../../core/logger.server", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { ficheResponse } = await import("./proxy.server");

/**
 * Shopify simulé au niveau de `admin.graphql` : la lecture renvoie la fiche prévue par le test, chaque mutation est
 * notée, et `customerUpdate` peut refuser le téléphone comme le fait Shopify quand un autre client l'a déjà.
 */
interface Call {
  readonly name: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

const calls: Call[] = [];
let customer: unknown = null;
let phoneTaken = false;
let readFails = false;

const EMPTY_CUSTOMER = {
  id: "gid://shopify/Customer/7",
  firstName: null,
  lastName: null,
  defaultPhoneNumber: null,
  companyContactProfiles: [
    {
      company: { name: "ZELIG" },
      roleAssignments: { nodes: [{ companyLocation: { id: "gid://shopify/CompanyLocation/10", phone: null, shippingAddress: null, billingAddress: null } }] },
    },
  ],
};

const COMPLETE_CUSTOMER = {
  ...EMPTY_CUSTOMER,
  firstName: "Lea",
  lastName: "Rochat",
  defaultPhoneNumber: { phoneNumber: "+41791234567" },
  companyContactProfiles: [
    {
      company: { name: "ZELIG" },
      roleAssignments: {
        nodes: [
          {
            companyLocation: {
              id: "gid://shopify/CompanyLocation/10",
              phone: null,
              shippingAddress: { address1: "Rue de Bourg 3", zip: "1003", city: "Lausanne" },
              billingAddress: { address1: "Rue de Bourg 3" },
            },
          },
        ],
      },
    },
  ],
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function reply(name: string): unknown {
  if (name === "FichePro") return { customer };
  if (name === "FicheProPersonne") {
    return { customerUpdate: { customer: null, userErrors: phoneTaken ? [{ field: ["phone"], message: "Phone has already been taken" }] : [] } };
  }
  if (name === "FicheProTelephone") return { companyLocationUpdate: { companyLocation: { id: "x" }, userErrors: [] } };
  return { companyLocationAssignAddress: { addresses: [{ id: "x" }], userErrors: [] } };
}

const admin = {
  graphql: async (document: string, options?: { variables?: Record<string, unknown> }): Promise<Response> => {
    const name = /(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? "";
    if (name === "FichePro" && readFails) throw new Error("réseau coupé");
    if (name !== "FichePro") calls.push({ name, variables: options?.variables ?? {} });
    return json({ data: reply(name) });
  },
} as unknown as AdminApiContext;

const liquid = (body: string, init?: ResponseInit): Response => new Response(body, init);

const PROXY = "https://bluepoint-gestion.vercel.app/proxy/bon-commande/ma-fiche?shop=bp.myshopify.com&signature=s";

function get(customerParam: string, extra = ""): Request {
  return new Request(`${PROXY}&logged_in_customer_id=${customerParam}${extra}`);
}

function post(fields: Record<string, string>): Request {
  return new Request(`${PROXY}&logged_in_customer_id=7`, { method: "POST", body: new URLSearchParams(fields) });
}

async function page(request: Request, withAdmin = true): Promise<string> {
  const response = await ficheResponse({ liquid, admin: withAdmin ? admin : undefined }, request);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return response.text();
}

const TYPED = { lieu: "10", firstName: "Lea", lastName: "Rochat", phone: "079 123 45 67", street: "Rue de Bourg 3", postalCode: "1003", city: "Lausanne", country: "CH" };

beforeEach(() => {
  calls.length = 0;
  customer = EMPTY_CUSTOMER;
  phoneTaken = false;
  readFails = false;
});

describe("proxy « Compléter ma fiche pro »", () => {
  it("demande de se connecter quand personne n'est connecté (ou un identifiant bizarre)", async () => {
    expect(await page(get(""))).toContain("Se connecter");
    expect(await page(get("7%20OR%201"))).toContain("Se connecter");
  });

  it("explique qu'un client sans entreprise n'a pas de fiche pro", async () => {
    customer = { ...EMPTY_CUSTOMER, companyContactProfiles: [] };
    expect(await page(get("7"))).toContain("pas encore rattaché à une entreprise");
  });

  it("montre le formulaire de ce qui manque", async () => {
    const html = await page(get("7", "&lieu=10"));
    expect(html).toContain("Il nous manque votre nom, votre numéro de téléphone et l’adresse de livraison.");
    expect(calls).toEqual([]);
  });

  it("dit que la fiche est complète quand rien ne manque", async () => {
    customer = COMPLETE_CUSTOMER;
    expect(await page(get("7"))).toContain("Votre fiche pro est complète");
  });

  it("enregistre la personne, le téléphone du restaurant et l'adresse, puis remercie", async () => {
    const html = await page(post(TYPED));
    expect(html).toContain("Merci, votre fiche pro est complète");
    expect(calls.map((call) => call.name)).toEqual(["FicheProPersonne", "FicheProTelephone", "FicheProAdresse"]);
    expect(calls[0]?.variables).toEqual({ input: { id: "gid://shopify/Customer/7", firstName: "Lea", lastName: "Rochat", phone: "+41791234567" } });
    expect(calls[2]?.variables).toMatchObject({ locationId: "gid://shopify/CompanyLocation/10", addressTypes: ["SHIPPING", "BILLING"] });
  });

  it("réaffiche le formulaire sans rien écrire quand une saisie est à corriger", async () => {
    const html = await page(post({ ...TYPED, postalCode: "10" }));
    expect(html).toContain("NPA à 4 chiffres");
    expect(calls).toEqual([]);
  });

  it("demande un autre numéro quand Shopify l'a déjà pour un autre client, sans écrire l'adresse", async () => {
    phoneTaken = true;
    const html = await page(post(TYPED));
    expect(html).toContain("déjà enregistré pour un autre client");
    expect(calls.map((call) => call.name)).toEqual(["FicheProPersonne"]);
  });

  it("n'écrit rien si la fiche était déjà complète (formulaire envoyé deux fois)", async () => {
    customer = COMPLETE_CUSTOMER;
    expect(await page(post(TYPED))).toContain("Merci, votre fiche pro est complète");
    expect(calls).toEqual([]);
  });

  it("s'excuse simplement quand Shopify ne répond pas ou que l'app n'est plus installée", async () => {
    readFails = true;
    expect(await page(get("7"))).toContain("Réessayez dans quelques minutes");
    expect(await page(get("7"), false)).toContain("Réessayez dans quelques minutes");
  });
});
