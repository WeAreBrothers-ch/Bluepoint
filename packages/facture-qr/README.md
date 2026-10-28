# @bluepoint/facture-qr

Factures PDF de BluePoint Distribution avec **QR-facture suisse** (adresses structurées, type S).
Fonctions pures : aucune écriture de fichier, aucun accès réseau. Node ≥ 20, ESM.

```ts
import { mapShopifyOrderToInvoiceInput, renderInvoicePdf, SHOPIFY_ORDER_INVOICE_QUERY } from "@bluepoint/facture-qr";

const facture = mapShopifyOrderToInvoiceInput(order, vendeur, {
  invoiceNumber: "BP-2026-0042", // tenu par la base de l'app
  issueDate: "2026-10-21",
  deliveryDate: "2026-10-20",
});
const pdf: Buffer = await renderInvoicePdf(facture);
```

- `validateInvoiceInput(raw)` : vérifie des données inconnues ; lève `FactureError` (`details` : un message par champ).
- Montants en centimes. TVA reprise telle quelle de Shopify (jamais recalculée) ; total contrôlé au centime près.
- Référence : QR-IBAN fourni → référence QR (27 chiffres) ; sinon référence RF, tirées du numéro de facture.
- Police Geist Mono livrée dans `assets/fonts` (licence SIL OFL, `OFL.txt`) : garder ce dossier avec le paquet.

```bash
npm install
npm run typecheck && npm test
npm run exemple   # écrit exemple.pdf dans le dossier temporaire
```
