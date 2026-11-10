import type { ValidInvoiceInput } from "./invoice-input";

/** Traduit une facture validée en corps de requête `{ documents: [...] }` (champs de la spec §2). */

type Position = ValidInvoiceInput["positions"][number];

function buildPosition(position: Position): object {
  return {
    positionNumber: position.positionNumber,
    kind: "product",
    ...(position.productNumber === undefined ? {} : { productNumber: position.productNumber }),
    productDescription: position.description,
    quantity: position.quantity,
    singlePrice: position.unitPrice,
    vat: { percentage: position.vatPercentage },
    ...(position.discountPercentage === undefined ? {} : { discount: { percentage: position.discountPercentage } }),
  };
}

function optionalText(key: "title" | "terms" | "publicNotes", value: string | undefined): object {
  return value === undefined ? {} : { [key]: value };
}

export function buildInvoiceBody(invoice: ValidInvoiceInput): { readonly documents: readonly [object] } {
  return {
    documents: [
      {
        currencyCode: invoice.currencyCode,
        reference: invoice.reference,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        pricesIncludeVat: invoice.pricesIncludeVat,
        receiver: invoice.receiver,
        paymentInstructions: { bankAccountUuid: invoice.bankAccountUuid },
        ...optionalText("title", invoice.title),
        ...optionalText("terms", invoice.terms),
        ...optionalText("publicNotes", invoice.publicNotes),
        positions: invoice.positions.map(buildPosition),
      },
    ],
  };
}
