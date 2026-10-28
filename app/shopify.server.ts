import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { readListEnv, readOptionalEnv, readRequiredEnv } from "./lib/core/env.server";

/** Version de l'Admin API utilisée partout (doit rester alignée sur shopify.app.toml). */
export const apiVersion = ApiVersion.October26;

const customShopDomain = readOptionalEnv("SHOP_CUSTOM_DOMAIN");

const shopify = shopifyApp({
  apiKey: readRequiredEnv("SHOPIFY_API_KEY"),
  apiSecretKey: readRequiredEnv("SHOPIFY_API_SECRET"),
  apiVersion,
  scopes: readListEnv("SCOPES"),
  appUrl: readRequiredEnv("SHOPIFY_APP_URL"),
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  // App sur mesure (distribution personnalisée) pour une seule boutique.
  distribution: AppDistribution.SingleMerchant,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(customShopDomain ? { customShopDomains: [customShopDomain] } : {}),
});

export default shopify;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
