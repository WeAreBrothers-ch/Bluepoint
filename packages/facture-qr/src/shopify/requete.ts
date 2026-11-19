/** Requête Admin GraphQL qui renvoie exactement le type `ShopifyOrderForInvoice` (variable `$id` : gid de la commande). */
export const SHOPIFY_ORDER_INVOICE_QUERY = `#graphql
query CommandePourFacture($id: ID!) {
  order(id: $id) {
    name
    createdAt
    customer { displayName defaultEmailAddress { emailAddress } }
    billingAddress { ...AdresseFacture }
    shippingAddress { ...AdresseFacture }
    lineItems(first: 100) {
      nodes {
        title
        variantTitle
        vendor
        quantity
        currentQuantity
        originalUnitPriceSet { shopMoney { amount currencyCode } }
        discountedTotalSet { shopMoney { amount currencyCode } }
      }
    }
    shippingLine { title }
    currentShippingPriceSet { shopMoney { amount currencyCode } }
    currentTaxLines {
      title
      rate
      ratePercentage
      priceSet { shopMoney { amount currencyCode } }
    }
    taxesIncluded
    currentSubtotalPriceSet { shopMoney { amount currencyCode } }
    currentTotalPriceSet { shopMoney { amount currencyCode } }
    discountCodes
    discountApplications(first: 5) {
      nodes { ... on AutomaticDiscountApplication { title } }
    }
    poNumber
  }
}

fragment AdresseFacture on MailingAddress {
  name
  firstName
  lastName
  company
  address1
  address2
  zip
  city
  countryCodeV2
}`;
