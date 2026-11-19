import { beforeEach, describe, expect, it, vi } from "vitest";
import { success } from "../core/result";
import type { ProRequestInput } from "./request";

/**
 * Shopify simulé : la recherche de clients renvoie ce que le test prévoit, l'e-mail du client seulement si la requête
 * le demande (comme la vraie API), et chaque mutation est notée.
 */
interface FakeCustomer {
  readonly id: string;
  readonly email: string;
}

const NEW_CUSTOMER_ID = "gid://shopify/Customer/nouveau";
const COMPANY_ID = "gid://shopify/Company/1";

let searchHits: readonly FakeCustomer[] = [];
let createdContactEmail: string | null = null;
const mutations: { readonly name: string; readonly variables: Readonly<Record<string, unknown>> }[] = [];

function searchResult(query: string) {
  const withEmail = query.includes("defaultEmailAddress");
  return {
    customers: {
      nodes: searchHits.map((hit) => ({
        id: hit.id,
        companyContactProfiles: [],
        ...(withEmail ? { defaultEmailAddress: { emailAddress: hit.email } } : {}),
      })),
    },
  };
}

function companyResult() {
  const contacts =
    createdContactEmail === null
      ? []
      : [{ id: "gid://shopify/CompanyContact/1", customer: { id: NEW_CUSTOMER_ID, defaultEmailAddress: { emailAddress: createdContactEmail } }, roleAssignments: { nodes: [] } }];
  return {
    company: {
      id: COMPANY_ID,
      contactRoles: { nodes: [{ id: "gid://shopify/CompanyContactRole/1", name: "Commande uniquement" }] },
      locations: { nodes: [{ id: "gid://shopify/CompanyLocation/1" }] },
      contacts: { nodes: contacts },
    },
  };
}

const MUTATION_DATA: Readonly<Record<string, unknown>> = {
  CreerEntreprisePro: { companyCreate: { company: { id: COMPANY_ID }, userErrors: [] } },
  RattacherClient: { companyAssignCustomerAsContact: { companyContact: { id: "gid://shopify/CompanyContact/2" }, userErrors: [] } },
  DonnerRole: { companyContactAssignRole: { companyContactRoleAssignment: { id: "gid://shopify/CompanyContactRoleAssignment/1" }, userErrors: [] } },
  EtiquettePro: { tagsAdd: { userErrors: [] } },
  InvitationPro: { companyContactSendWelcomeEmail: { companyContact: { id: "gid://shopify/CompanyContact/1" }, userErrors: [] } },
};

function operationName(document: string): string {
  return /(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? "";
}

vi.mock("../shopify/graphql.server", () => ({
  runAdminGraphql: vi.fn(async (_admin: unknown, query: string) =>
    success(operationName(query) === "ClientParEmail" ? searchResult(query) : companyResult()),
  ),
  runAdminMutation: vi.fn(async (_admin: unknown, mutation: string, pick: (data: unknown) => unknown, variables: Record<string, unknown>) => {
    const name = operationName(mutation);
    mutations.push({ name, variables });
    const contact = (variables.input as { companyContact?: { email: string } } | undefined)?.companyContact;
    if (name === "CreerEntreprisePro" && contact !== undefined) createdContactEmail = contact.email;
    return success(pick(MUTATION_DATA[name]));
  }),
}));

vi.mock("../core/logger.server", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const { makePro } = await import("./shopify.server");

const admin = {} as Parameters<typeof makePro>[0];

const request: ProRequestInput = {
  companyName: "Restaurant Fictif",
  firstName: "Alice",
  lastName: "Test",
  email: "info@dummy-resto.test",
  phone: "+41790000001",
  street: "Rue Fictive 1",
  postalCode: "1095",
  city: "Lutry",
  country: "CH",
  vatNumber: null,
  message: null,
};

const options = { existingCompanyId: null, paymentTermsTemplateId: null, onCompanyCreated: async (): Promise<void> => {} };

function variablesOf(name: string): readonly Readonly<Record<string, unknown>>[] {
  return mutations.filter((mutation) => mutation.name === name).map((mutation) => mutation.variables);
}

beforeEach(() => {
  searchHits = [];
  createdContactEmail = null;
  mutations.length = 0;
});

describe("makePro : choix du client Shopify", () => {
  it("ignore un client trouvé dont l'e-mail n'est pas exactement celui de la demande", async () => {
    searchHits = [{ id: "gid://shopify/Customer/autre", email: "info@dummy-resto.test.autre.test" }];

    const result = await makePro(admin, request, options);

    expect(result).toMatchObject({ ok: true, value: { customerId: NEW_CUSTOMER_ID } });
    expect(variablesOf("CreerEntreprisePro")[0]).toMatchObject({ input: { companyContact: { email: "info@dummy-resto.test" } } });
    expect(variablesOf("RattacherClient")).toEqual([]);
    expect(variablesOf("EtiquettePro")).toEqual([{ id: NEW_CUSTOMER_ID, tags: ["pro"] }]);
  });

  it("rattache le client dont l'e-mail est identique, même s'il n'arrive pas en premier", async () => {
    searchHits = [
      { id: "gid://shopify/Customer/autre", email: "xinfo@dummy-resto.test" },
      { id: "gid://shopify/Customer/42", email: "INFO@Dummy-Resto.test" },
    ];

    const result = await makePro(admin, request, options);

    expect(result).toMatchObject({ ok: true, value: { customerId: "gid://shopify/Customer/42" } });
    expect(variablesOf("RattacherClient")).toEqual([{ companyId: COMPANY_ID, customerId: "gid://shopify/Customer/42" }]);
    expect(variablesOf("EtiquettePro")).toEqual([{ id: "gid://shopify/Customer/42", tags: ["pro"] }]);
  });
});
