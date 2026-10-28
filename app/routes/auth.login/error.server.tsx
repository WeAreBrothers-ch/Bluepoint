import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

interface LoginErrorMessage {
  shop?: string;
}

/** Messages d'erreur de connexion, en français. */
export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "Indiquez l’adresse de la boutique pour vous connecter." };
  }
  if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "Adresse de boutique invalide (format : nom.myshopify.com)." };
  }
  return {};
}
